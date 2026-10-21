import { aspectForPlatform } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { config, geminiConfigured } from "@/lib/config";
import { parseContentResult, parseModelJson, variantsSchema } from "@/lib/ai/schemas";
import { buildGenerationPrompt, buildImagePrompt } from "@/lib/ai/prompts";
import { embedText, generateImage, generateText } from "@/lib/ai/providers";
import { imageSize } from "@/lib/content/format";
import { chunksForWorkspace, rankByKeyword, rankByVector } from "@/lib/knowledge/rank";
import {
  claimIdempotency,
  findAssetForWorkspace,
  findProject,
  findVersion,
  finishIdempotency,
  insertAsset,
  insertAudit,
  insertProductEvent,
  insertUsage,
  insertVersion,
  listAssets,
  listChunksForWorkspace,
  listVersions,
  newId,
  readIdempotency,
  releaseIdempotency,
  updateAsset,
  updateProject,
  type UserRow,
} from "@/lib/db/repo";
import { deletePrivate, storageMode, writePrivate } from "@/lib/storage/files";
import { requireWorkspace } from "@/lib/services/account";
import { assertQuota, assertRate } from "@/lib/services/quota";
import type { ContentResult, SourceRef, TaskInput } from "@/lib/types";

const TEXT_ROUTE = "content.text";

async function beginIdempotency(userId: string, route: string, key: string) {
  if (!key) return { replay: null as unknown };
  const existing = await readIdempotency(userId, route, key);
  if (existing?.status === "done" && existing.response_json) {
    return { replay: JSON.parse(String(existing.response_json)) as unknown };
  }
  if (existing?.status === "pending") {
    const age = Date.now() - new Date(String(existing.created_at)).getTime();
    if (age < 120_000) throw new AppError("Такой запрос уже выполняется.", 409, "IN_PROGRESS");
    await releaseIdempotency(userId, route, key);
  }
  try {
    await claimIdempotency(userId, route, key);
  } catch {
    throw new AppError("Такой запрос уже выполняется.", 409, "IN_PROGRESS");
  }
  return { replay: null as unknown };
}

export async function ownedProject(userId: string, projectId: string) {
  const workspace = await requireWorkspace(userId);
  const project = await findProject(workspace.id, projectId);
  if (!project) throw new AppError("Проект не найден.", 404, "NOT_FOUND");
  return { workspace, project };
}

async function recordUsage(input: {
  user: UserRow;
  workspaceId: string | null;
  projectId: string | null;
  operation: string;
  modelId: string;
  status: string;
  requestId: string;
  errorCode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}) {
  await insertUsage({
    id: newId(),
    userId: input.user.id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    operation: input.operation,
    modelId: input.modelId,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCost: null,
    status: input.status,
    requestId: input.requestId,
    errorCode: input.errorCode ?? null,
  });
}

export async function retrieveForWorkspace(workspaceId: string, query: string) {
  const loaded = await listChunksForWorkspace(workspaceId, config.retrievalScanLimit);
  const scoped = chunksForWorkspace(loaded, workspaceId);
  if (scoped.length === 0) return { chunks: [], mode: "empty" as const };
  const canVector =
    geminiConfigured() &&
    scoped.some(
      (chunk) =>
        chunk.embedding &&
        chunk.embeddingModel === config.embeddingModel &&
        chunk.embedding.length === config.embeddingDimensions,
    );
  if (canVector) {
    try {
      const vector = await embedText(`task: search result | query: ${query.slice(0, 2000)}`);
      const ranked = rankByVector(scoped, vector, config.embeddingModel, config.embeddingDimensions, config.retrievalLimit);
      return { chunks: ranked, mode: ranked.length ? ("vector" as const) : ("empty" as const) };
    } catch {
      const ranked = rankByKeyword(scoped, query, config.retrievalLimit);
      return { chunks: ranked, mode: ranked.length ? ("keyword" as const) : ("unavailable" as const) };
    }
  }
  const ranked = rankByKeyword(scoped, query, config.retrievalLimit);
  return { chunks: ranked, mode: ranked.length ? ("keyword" as const) : ("empty" as const) };
}

function sourcesFrom(chunks: Awaited<ReturnType<typeof retrieveForWorkspace>>["chunks"]): SourceRef[] {
  return chunks.map((chunk) => ({
    documentId: chunk.documentId,
    title: chunk.documentTitle,
    chunkId: chunk.id,
    page: chunk.pageNumber,
    excerpt: chunk.text.replace(/\s+/g, " ").slice(0, 240),
  }));
}

async function callText(input: {
  user: UserRow;
  workspaceId: string;
  projectId: string;
  operation: string;
  requestId: string;
  system: string;
  prompt: string;
  signal?: AbortSignal;
}) {
  try {
    const result = await generateText(input.system, input.prompt, input.signal);
    return result;
  } catch (error) {
    const code = error instanceof AppError ? error.code : "INTERNAL";
    await recordUsage({
      user: input.user,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      operation: input.operation,
      modelId: config.textModel,
      status: "failed",
      requestId: input.requestId,
      errorCode: code,
    });
    throw error;
  }
}

export async function generateDraft(input: {
  user: UserRow;
  task: TaskInput;
  projectId: string;
  requestId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}) {
  const gate = await beginIdempotency(input.user.id, TEXT_ROUTE, input.idempotencyKey);
  if (gate.replay) return gate.replay;
  try {
    const { workspace, project } = await ownedProject(input.user.id, input.projectId);
    await assertRate(input.user.id);
    await assertQuota(input.user.id, "text");
    await updateProject(workspace.id, project.id, { task: input.task, status: project.status });
    const brand = (await import("@/lib/db/repo")).findBrand;
    const brandProfile = await brand(workspace.id);
    let knowledgeMode: "vector" | "keyword" | "empty" | "unavailable" | "skipped" = "skipped";
    let chunks: Awaited<ReturnType<typeof retrieveForWorkspace>>["chunks"] = [];
    if (input.task.useKnowledgeBase) {
      try {
        const found = await retrieveForWorkspace(workspace.id, `${input.task.topic}\n${input.task.goal}`);
        chunks = found.chunks;
        knowledgeMode = found.mode;
      } catch {
        knowledgeMode = "unavailable";
      }
    }
    const prompt = buildGenerationPrompt({
      brand: brandProfile,
      task: input.task,
      chunks: chunks.map((chunk) => ({
        title: chunk.documentTitle,
        page: chunk.pageNumber,
        text: chunk.text.slice(0, Math.floor(config.maxKnowledgeChars / Math.max(chunks.length, 1))),
      })),
    });
    const generated = await callText({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_generate",
      requestId: input.requestId,
      system: prompt.system,
      prompt: prompt.user,
      signal: input.signal,
    });
    const content = parseContentResult(parseModelJson(generated.text), {
      language: input.task.language,
      format: input.task.contentType,
      fallbackTitle: input.task.topic,
    });
    const sources = sourcesFrom(chunks);
    const versionId = newId();
    await insertVersion({
      id: versionId,
      projectId: project.id,
      parentVersionId: null,
      promptSummary: input.task.topic,
      content,
      sources,
      modelId: generated.modelId,
      status: "success",
    });
    await updateProject(workspace.id, project.id, {
      title: project.title || content.title,
      status: "ready",
      task: input.task,
    });
    await recordUsage({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_generate",
      modelId: generated.modelId,
      status: "success",
      requestId: input.requestId,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
    });
    await insertProductEvent(input.user.id, "first_result", project.id);
    const response = { versionId, content, sources, knowledgeStatus: knowledgeMode, modelId: generated.modelId };
    if (input.idempotencyKey) await finishIdempotency(input.user.id, TEXT_ROUTE, input.idempotencyKey, response);
    return response;
  } catch (error) {
    if (input.idempotencyKey) await releaseIdempotency(input.user.id, TEXT_ROUTE, input.idempotencyKey);
    throw error;
  }
}

export async function editDraft(input: {
  user: UserRow;
  projectId: string;
  baseVersionId: string;
  instruction: string;
  requestId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}) {
  const route = "content.edit";
  const gate = await beginIdempotency(input.user.id, route, input.idempotencyKey);
  if (gate.replay) return gate.replay;
  try {
    const { workspace, project } = await ownedProject(input.user.id, input.projectId);
    const base = await findVersion(project.id, input.baseVersionId);
    if (!base) throw new AppError("Версия не найдена.", 404, "NOT_FOUND");
    await assertRate(input.user.id);
    await assertQuota(input.user.id, "text");
    const brandProfile = await (await import("@/lib/db/repo")).findBrand(workspace.id);
    let chunks: Awaited<ReturnType<typeof retrieveForWorkspace>>["chunks"] = [];
    let knowledgeMode: "vector" | "keyword" | "empty" | "unavailable" | "skipped" = "skipped";
    if (project.task.useKnowledgeBase) {
      try {
        const found = await retrieveForWorkspace(workspace.id, `${project.task.topic}\n${input.instruction}`);
        chunks = found.chunks;
        knowledgeMode = found.mode;
      } catch {
        knowledgeMode = "unavailable";
      }
    }
    const prompt = buildGenerationPrompt({
      brand: brandProfile,
      task: project.task,
      chunks: chunks.map((chunk) => ({ title: chunk.documentTitle, page: chunk.pageNumber, text: chunk.text.slice(0, 1500) })),
      draft: base.content,
      instruction: input.instruction,
    });
    const generated = await callText({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_edit",
      requestId: input.requestId,
      system: prompt.system,
      prompt: prompt.user,
      signal: input.signal,
    });
    const content = parseContentResult(parseModelJson(generated.text), {
      language: project.task.language,
      format: project.contentType,
      fallbackTitle: base.content.title,
    });
    const sources = sourcesFrom(chunks);
    const versionId = newId();
    await insertVersion({
      id: versionId,
      projectId: project.id,
      parentVersionId: base.id,
      promptSummary: input.instruction,
      content,
      sources,
      modelId: generated.modelId,
      status: "success",
    });
    await updateProject(workspace.id, project.id, { status: "ready" });
    await recordUsage({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_edit",
      modelId: generated.modelId,
      status: "success",
      requestId: input.requestId,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
    });
    const response = { versionId, content, sources, knowledgeStatus: knowledgeMode, modelId: generated.modelId };
    if (input.idempotencyKey) await finishIdempotency(input.user.id, route, input.idempotencyKey, response);
    return response;
  } catch (error) {
    if (input.idempotencyKey) await releaseIdempotency(input.user.id, route, input.idempotencyKey);
    throw error;
  }
}

export async function createVariants(input: {
  user: UserRow;
  projectId: string;
  baseVersionId?: string;
  requestId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}) {
  const route = "content.variants";
  const gate = await beginIdempotency(input.user.id, route, input.idempotencyKey);
  if (gate.replay) return gate.replay;
  try {
    const { workspace, project } = await ownedProject(input.user.id, input.projectId);
    const versions = await listVersions(project.id);
    const base = input.baseVersionId
      ? await findVersion(project.id, input.baseVersionId)
      : versions[versions.length - 1];
    if (!base) throw new AppError("Сначала создайте черновик.", 400, "NO_VERSION");
    await assertRate(input.user.id);
    await assertQuota(input.user.id, "text");
    const brandProfile = await (await import("@/lib/db/repo")).findBrand(workspace.id);
    const prompt = buildGenerationPrompt({
      brand: brandProfile,
      task: project.task,
      chunks: [],
      draft: base.content,
      instruction: "Сделай три разных подхода, сохранив факты и запреты.",
      variants: true,
    });
    const generated = await callText({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_variants",
      requestId: input.requestId,
      system: prompt.system,
      prompt: prompt.user,
      signal: input.signal,
    });
    const parsed = variantsSchema.safeParse(parseModelJson(generated.text));
    if (!parsed.success) {
      throw new AppError("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
    }
    const versionIds: string[] = [];
    for (const variant of parsed.data.variants) {
      const content = parseContentResult(variant, {
        language: project.task.language,
        format: project.contentType,
        fallbackTitle: base.content.title,
      });
      const versionId = newId();
      versionIds.push(versionId);
      await insertVersion({
        id: versionId,
        projectId: project.id,
        parentVersionId: base.id,
        promptSummary: "Три варианта",
        content,
        sources: base.sources,
        modelId: generated.modelId,
        status: "success",
      });
    }
    await recordUsage({
      user: input.user,
      workspaceId: workspace.id,
      projectId: project.id,
      operation: "text_variants",
      modelId: generated.modelId,
      status: "success",
      requestId: input.requestId,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
    });
    const response = { versionIds };
    if (input.idempotencyKey) await finishIdempotency(input.user.id, route, input.idempotencyKey, response);
    return response;
  } catch (error) {
    if (input.idempotencyKey) await releaseIdempotency(input.user.id, route, input.idempotencyKey);
    throw error;
  }
}

export async function saveManual(input: {
  user: UserRow;
  projectId: string;
  content: ContentResult;
  baseVersionId?: string | null;
}) {
  const { workspace, project } = await ownedProject(input.user.id, input.projectId);
  const versionId = newId();
  await insertVersion({
    id: versionId,
    projectId: project.id,
    parentVersionId: input.baseVersionId || null,
    promptSummary: "Правка вручную",
    content: { ...input.content, format: project.contentType },
    sources: [],
    modelId: "",
    status: "manual",
  });
  await updateProject(workspace.id, project.id, { title: input.content.title, status: "ready" });
  await insertProductEvent(input.user.id, "saved", project.id);
  return { versionId };
}

export async function restoreVersion(user: UserRow, projectId: string, versionId: string) {
  const { project } = await ownedProject(user.id, projectId);
  const version = await findVersion(project.id, versionId);
  if (!version) throw new AppError("Версия не найдена.", 404, "NOT_FOUND");
  const restoredId = newId();
  await insertVersion({
    id: restoredId,
    projectId: project.id,
    parentVersionId: version.id,
    promptSummary: `Восстановлено из версии ${version.createdAt}`,
    content: version.content,
    sources: version.sources,
    modelId: "",
    status: "restored",
  });
  return { versionId: restoredId };
}

export async function projectPayload(userId: string, projectId: string) {
  const { project } = await ownedProject(userId, projectId);
  const [versions, assets] = await Promise.all([listVersions(project.id), listAssets(project.id)]);
  return {
    project,
    versions,
    assets: assets.map((asset) => ({
      id: asset.id,
      status: asset.status,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      errorMessage: asset.errorMessage,
      createdAt: asset.createdAt,
      downloadUrl: asset.status === "ready" ? `/api/assets/${asset.id}/file` : null,
    })),
  };
}

export async function createVisual(input: {
  user: UserRow;
  projectId: string;
  versionId?: string;
  note: string;
  requestId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}) {
  const route = "content.image";
  const gate = await beginIdempotency(input.user.id, route, input.idempotencyKey);
  if (gate.replay) return gate.replay;
  try {
    if (storageMode() === "none") {
      throw new AppError("Хранилище файлов не настроено. Подключите Vercel Blob.", 503, "STORAGE_UNAVAILABLE");
    }
    const { workspace, project } = await ownedProject(input.user.id, input.projectId);
    const versions = await listVersions(project.id);
    const version = input.versionId ? await findVersion(project.id, input.versionId) : versions[versions.length - 1];
    if (!version) throw new AppError("Сначала создайте черновик.", 400, "NO_VERSION");
    await assertRate(input.user.id);
    await assertQuota(input.user.id, "image");
    const brandProfile = await (await import("@/lib/db/repo")).findBrand(workspace.id);
    const prompt = buildImagePrompt({
      brandName: brandProfile.name,
      topic: project.task.topic || project.title,
      visualPrompt: version.content.visualPrompt,
      note: input.note,
      platform: project.platform,
    });
    const assetId = newId();
    await insertAsset({
      id: assetId,
      projectId: project.id,
      modelId: config.imageModel,
      promptSummary: prompt.slice(0, 240),
      status: "processing",
    });
    try {
      const image = await generateImage(prompt, aspectForPlatform(project.platform), input.signal);
      const bytes = Buffer.from(image.data, "base64");
      const extension = image.mimeType.includes("jpeg") ? "jpg" : "png";
      const storageKey = await writePrivate(`assets/${assetId}.${extension}`, new Uint8Array(bytes), image.mimeType);
      if (!storageKey) throw new AppError("Не удалось сохранить изображение.", 503, "STORAGE_UNAVAILABLE");
      const size = imageSize(new Uint8Array(bytes));
      await updateAsset(assetId, {
        storageKey,
        mimeType: image.mimeType,
        sizeBytes: bytes.length,
        width: size.width,
        height: size.height,
        status: "ready",
      });
      await recordUsage({
        user: input.user,
        workspaceId: workspace.id,
        projectId: project.id,
        operation: "image_generate",
        modelId: image.modelId,
        status: "success",
        requestId: input.requestId,
        inputTokens: image.usage.inputTokens,
        outputTokens: image.usage.outputTokens,
      });
    } catch (error) {
      const message = error instanceof AppError ? error.message : "Не удалось создать изображение.";
      const code = error instanceof AppError ? error.code : "INTERNAL";
      await updateAsset(assetId, { status: "failed", errorMessage: message });
      await recordUsage({
        user: input.user,
        workspaceId: workspace.id,
        projectId: project.id,
        operation: "image_generate",
        modelId: config.imageModel,
        status: "failed",
        requestId: input.requestId,
        errorCode: code,
      });
      throw error;
    }
    const response = { assetId, status: "ready", downloadUrl: `/api/assets/${assetId}/file` };
    if (input.idempotencyKey) await finishIdempotency(input.user.id, route, input.idempotencyKey, response);
    return response;
  } catch (error) {
    if (input.idempotencyKey) await releaseIdempotency(input.user.id, route, input.idempotencyKey);
    throw error;
  }
}

export async function readAssetFile(userId: string, assetId: string) {
  const workspace = await requireWorkspace(userId);
  const asset = await findAssetForWorkspace(workspace.id, assetId);
  if (!asset || asset.status !== "ready") throw new AppError("Файл не найден.", 404, "NOT_FOUND");
  const { readPrivate } = await import("@/lib/storage/files");
  const bytes = await readPrivate(asset.storageKey);
  if (!bytes) throw new AppError("Файл не найден.", 404, "NOT_FOUND");
  return { asset, bytes };
}

export async function removeProject(user: UserRow, projectId: string) {
  const { workspace, project } = await ownedProject(user.id, projectId);
  const { deleteProject } = await import("@/lib/db/repo");
  const keys = await deleteProject(workspace.id, project.id);
  await Promise.all(keys.map((key) => deletePrivate(key)));
  await insertAudit(user.id, "delete_project", "project", project.id);
}
