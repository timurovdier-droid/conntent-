import { config, geminiConfigured, pipelineStamp } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { embedText } from "@/lib/ai/providers";
import { chunkDocument, detectKind } from "@/lib/knowledge/chunk";
import { extractPieces } from "@/lib/knowledge/extract";
import {
  deleteDocument,
  findDocument,
  insertAudit,
  insertDocument,
  insertUsage,
  listDocuments,
  newId,
  replaceChunks,
  sha256,
  updateDocument,
  type UserRow,
} from "@/lib/db/repo";
import { deletePrivate, readPrivate, writePrivate } from "@/lib/storage/files";
import { requireWorkspace } from "@/lib/services/account";
import { assertQuota, assertRate } from "@/lib/services/quota";

async function indexText(input: {
  user: UserRow;
  workspaceId: string;
  documentId: string;
  title: string;
  pieces: { page: number | null; text: string }[];
  requestId: string;
  chargeUpload: boolean;
}) {
  const joined = input.pieces.map((piece) => piece.text).join("\n\n").slice(0, config.maxExtractedChars);
  if (joined.trim().length < 20) {
    await updateDocument(input.workspaceId, input.documentId, {
      status: "failed",
      errorCode: "EMPTY_DOCUMENT",
      errorMessage: "В источнике почти нет текста. Проверьте файл или вставьте текст вручную.",
      extractedText: joined,
    });
    await insertUsage({
      id: newId(),
      userId: input.user.id,
      workspaceId: input.workspaceId,
      projectId: null,
      operation: "kb_upload",
      modelId: "",
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      status: "failed",
      requestId: input.requestId,
      errorCode: "EMPTY_DOCUMENT",
    });
    return;
  }
  const chunks = chunkDocument(input.pieces.map((piece) => ({ ...piece, text: piece.text.slice(0, config.maxExtractedChars) }))).slice(
    0,
    config.maxChunks,
  );
  let indexNote = "";
  let embedded = 0;
  const stored = [];
  for (const [index, chunk] of chunks.entries()) {
    let embedding: number[] | null = null;
    if (geminiConfigured()) {
      try {
        await assertQuota(input.user.id, "embed");
        embedding = await embedText(`title: ${input.title || "none"} | text: ${chunk.text}`);
        embedded += 1;
      } catch {
        indexNote = "Текст сохранён. Векторный поиск сейчас недоступен, используется поиск по словам.";
        embedding = null;
      }
    } else {
      indexNote = "Текст сохранён. Добавьте GEMINI_API_KEY, чтобы построить векторный индекс.";
    }
    stored.push({
      id: newId(),
      workspaceId: input.workspaceId,
      chunkIndex: index,
      text: chunk.text,
      pageNumber: chunk.page,
      embedding,
      embeddingModel: embedding ? config.embeddingModel : null,
      pipelineVersion: pipelineStamp(),
    });
    if (indexNote && !embedding) {
      for (const rest of chunks.slice(index + 1)) {
        stored.push({
          id: newId(),
          workspaceId: input.workspaceId,
          chunkIndex: stored.length,
          text: rest.text,
          pageNumber: rest.page,
          embedding: null,
          embeddingModel: null,
          pipelineVersion: pipelineStamp(),
        });
      }
      break;
    }
  }
  await replaceChunks(input.documentId, stored);
  await updateDocument(input.workspaceId, input.documentId, {
    status: "ready",
    errorCode: null,
    errorMessage: "",
    indexNote,
    contentHash: sha256(joined),
    extractedText: joined,
  });
  if (input.chargeUpload) {
    await insertUsage({
      id: newId(),
      userId: input.user.id,
      workspaceId: input.workspaceId,
      projectId: null,
      operation: "kb_upload",
      modelId: "",
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      status: "success",
      requestId: input.requestId,
      errorCode: null,
    });
  }
  if (embedded > 0) {
    await insertUsage({
      id: newId(),
      userId: input.user.id,
      workspaceId: input.workspaceId,
      projectId: null,
      operation: "kb_index",
      modelId: config.embeddingModel,
      inputTokens: Math.ceil(joined.length / 4),
      outputTokens: null,
      estimatedCost: null,
      status: "success",
      requestId: input.requestId,
      errorCode: null,
    });
  }
}

export async function addNote(user: UserRow, title: string, text: string, requestId: string) {
  const workspace = await requireWorkspace(user.id);
  await assertRate(user.id);
  await assertQuota(user.id, "upload");
  const id = newId();
  await insertDocument({
    id,
    workspaceId: workspace.id,
    title,
    sourceType: "note",
    mimeType: "text/plain",
    sizeBytes: Buffer.byteLength(text),
    storageKey: null,
  });
  await indexText({
    user,
    workspaceId: workspace.id,
    documentId: id,
    title,
    pieces: [{ page: null, text }],
    requestId,
    chargeUpload: true,
  });
  return findDocument(workspace.id, id);
}

export async function addFile(user: UserRow, filename: string, bytes: Uint8Array, requestId: string) {
  if (bytes.byteLength > config.maxUploadBytes) {
    throw new AppError("Файл больше разрешённого размера.", 413, "FILE_TOO_LARGE");
  }
  const kind = detectKind(filename, bytes);
  if (!kind) {
    throw new AppError("Поддерживаются PDF, DOCX, TXT и Markdown.", 415, "UNSUPPORTED_FILE");
  }
  const workspace = await requireWorkspace(user.id);
  await assertRate(user.id);
  await assertQuota(user.id, "upload");
  const id = newId();
  const title = filename.replace(/\.[^.]+$/, "").slice(0, 180) || "Документ";
  const storageKey = await writePrivate(`knowledge/${workspace.id}/${id}`, bytes, kind === "pdf" ? "application/pdf" : "application/octet-stream");
  await insertDocument({
    id,
    workspaceId: workspace.id,
    title,
    sourceType: kind,
    mimeType: kind,
    sizeBytes: bytes.byteLength,
    storageKey,
  });
  try {
    const pieces = await extractPieces(kind, bytes);
    await indexText({ user, workspaceId: workspace.id, documentId: id, title, pieces, requestId, chargeUpload: true });
  } catch (error) {
    await updateDocument(workspace.id, id, {
      status: "failed",
      errorCode: "EXTRACT_FAILED",
      errorMessage: "Не удалось прочитать файл. Проверьте, что он не повреждён, и повторите обработку.",
    });
    await insertUsage({
      id: newId(),
      userId: user.id,
      workspaceId: workspace.id,
      projectId: null,
      operation: "kb_upload",
      modelId: "",
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      status: "failed",
      requestId,
      errorCode: error instanceof Error && error.message === "ENCODING" ? "ENCODING" : "EXTRACT_FAILED",
    });
  }
  return findDocument(workspace.id, id);
}

export async function reindexDocument(user: UserRow, documentId: string, requestId: string) {
  const workspace = await requireWorkspace(user.id);
  const document = await findDocument(workspace.id, documentId);
  if (!document) throw new AppError("Источник не найден.", 404, "NOT_FOUND");
  await assertRate(user.id);
  await updateDocument(workspace.id, document.id, { status: "processing", errorMessage: "", errorCode: null });
  let pieces = [{ page: null as number | null, text: document.extractedText }];
  if (document.storageKey) {
    const bytes = await readPrivate(document.storageKey);
    if (bytes && (document.sourceType === "pdf" || document.sourceType === "docx" || document.sourceType === "text")) {
      try {
        pieces = await extractPieces(document.sourceType, bytes);
      } catch {
        pieces = [{ page: null, text: document.extractedText }];
      }
    }
  }
  await indexText({
    user,
    workspaceId: workspace.id,
    documentId: document.id,
    title: document.title,
    pieces,
    requestId,
    chargeUpload: false,
  });
  return findDocument(workspace.id, document.id);
}

export async function removeDocument(user: UserRow, documentId: string) {
  const workspace = await requireWorkspace(user.id);
  const document = await deleteDocument(workspace.id, documentId);
  if (!document) throw new AppError("Источник не найден.", 404, "NOT_FOUND");
  await deletePrivate(document.storageKey);
  await insertAudit(user.id, "delete_document", "knowledge_document", documentId);
}

export async function documentsFor(userId: string) {
  const workspace = await requireWorkspace(userId);
  return listDocuments(workspace.id);
}

export async function documentFor(userId: string, documentId: string) {
  const workspace = await requireWorkspace(userId);
  const document = await findDocument(workspace.id, documentId);
  if (!document) throw new AppError("Источник не найден.", 404, "NOT_FOUND");
  return {
    id: document.id,
    title: document.title,
    sourceType: document.sourceType,
    status: document.status,
    errorMessage: document.errorMessage,
    indexNote: document.indexNote,
    sizeBytes: document.sizeBytes,
    excerpt: document.extractedText.replace(/\s+/g, " ").slice(0, 280),
    updatedAt: document.updatedAt,
  };
}
