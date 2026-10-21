import { createHash, randomBytes } from "node:crypto";
import type { InValue } from "@libsql/client";
import { execute, executeBatch, queryMany, queryOne } from "@/lib/db/repo-db";
import type { BrandInput, ContentResult, SourceRef, TaskInput } from "@/lib/types";

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value == null ? "" : String(value);
}

function nullable(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value == null ? null : String(value);
}

function num(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value == null ? 0 : Number(value);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  locale: string;
  status: string;
  isAdmin: boolean;
  createdAt: string;
};

function mapUser(row: Record<string, unknown>): UserRow {
  return {
    id: text(row, "id"),
    email: text(row, "email"),
    passwordHash: text(row, "password_hash"),
    locale: text(row, "locale"),
    status: text(row, "status"),
    isAdmin: num(row, "is_admin") === 1,
    createdAt: text(row, "created_at"),
  };
}

export async function findUserById(id: string) {
  const row = await queryOne("SELECT * FROM users WHERE id = ?", [id]);
  return row ? mapUser(row) : null;
}

export async function findUserByEmail(email: string) {
  const row = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  return row ? mapUser(row) : null;
}

export async function insertUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  locale: string;
  isAdmin: boolean;
}) {
  const createdAt = nowIso();
  await execute(
    `INSERT INTO users (id, auth_provider_id, email, password_hash, locale, status, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    [input.id, `local:${input.id}`, input.email, input.passwordHash, input.locale, input.isAdmin ? 1 : 0, createdAt],
  );
}

export async function updateUser(id: string, patch: { locale?: string; status?: string; passwordHash?: string; isAdmin?: boolean }) {
  const current = await findUserById(id);
  if (!current) return;
  await execute(
    `UPDATE users SET locale = ?, status = ?, password_hash = ?, is_admin = ? WHERE id = ?`,
    [
      patch.locale ?? current.locale,
      patch.status ?? current.status,
      patch.passwordHash ?? current.passwordHash,
      patch.isAdmin == null ? (current.isAdmin ? 1 : 0) : patch.isAdmin ? 1 : 0,
      id,
    ],
  );
}

export async function listUsers() {
  const rows = await queryMany(
    `SELECT u.id, u.email, u.locale, u.status, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM usage_events e WHERE e.user_id = u.id AND e.status = 'success') AS success_count
     FROM users u ORDER BY u.created_at DESC LIMIT 200`,
  );
  return rows.map((row) => ({
    id: text(row, "id"),
    email: text(row, "email"),
    locale: text(row, "locale"),
    status: text(row, "status"),
    isAdmin: num(row, "is_admin") === 1,
    createdAt: text(row, "created_at"),
    successCount: num(row, "success_count"),
  }));
}

export async function insertResetToken(id: string, userId: string, tokenHash: string, expiresAt: string) {
  await execute(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, userId, tokenHash, expiresAt, nowIso()],
  );
}

export async function consumeResetToken(tokenHash: string) {
  const row = await queryOne(
    `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    [tokenHash, nowIso()],
  );
  if (!row) return null;
  await execute("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", [nowIso(), text(row, "id")]);
  return text(row, "user_id");
}

export type WorkspaceRow = { id: string; ownerId: string; name: string };

export async function findWorkspaceByOwner(ownerId: string) {
  const row = await queryOne("SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at ASC LIMIT 1", [ownerId]);
  if (!row) return null;
  return { id: text(row, "id"), ownerId: text(row, "owner_id"), name: text(row, "name") };
}

export async function insertWorkspace(id: string, ownerId: string, name: string) {
  const stamp = nowIso();
  await execute(
    `INSERT INTO workspaces (id, owner_id, name, settings_json, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)`,
    [id, ownerId, name, stamp, stamp],
  );
}

export async function findBrand(workspaceId: string): Promise<BrandInput & { id: string }> {
  const row = await queryOne("SELECT * FROM brand_profiles WHERE workspace_id = ?", [workspaceId]);
  if (!row) {
    return {
      id: "",
      name: "",
      niche: "",
      products: [],
      audience: "",
      tone: "",
      language: "ru",
      valueProposition: "",
      ctaDefaults: [],
      forbiddenTerms: [],
    };
  }
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    niche: text(row, "niche"),
    products: parseJson<string[]>(text(row, "products_json"), []),
    audience: text(row, "audience"),
    tone: text(row, "tone"),
    language: text(row, "language") || "ru",
    valueProposition: text(row, "value_proposition"),
    ctaDefaults: parseJson<string[]>(text(row, "cta_defaults_json"), []),
    forbiddenTerms: parseJson<string[]>(text(row, "forbidden_terms_json"), []),
  };
}

export async function saveBrand(workspaceId: string, brand: BrandInput) {
  const existing = await queryOne("SELECT id FROM brand_profiles WHERE workspace_id = ?", [workspaceId]);
  const stamp = nowIso();
  const args: InValue[] = [
    brand.name,
    brand.niche,
    JSON.stringify(brand.products),
    brand.audience,
    brand.tone,
    brand.language,
    brand.valueProposition,
    JSON.stringify(brand.ctaDefaults),
    JSON.stringify(brand.forbiddenTerms),
    stamp,
  ];
  if (existing) {
    await execute(
      `UPDATE brand_profiles
       SET name = ?, niche = ?, products_json = ?, audience = ?, tone = ?, language = ?, value_proposition = ?,
           cta_defaults_json = ?, forbidden_terms_json = ?, updated_at = ?
       WHERE workspace_id = ?`,
      [...args, workspaceId],
    );
    return;
  }
  await execute(
    `INSERT INTO brand_profiles
      (id, workspace_id, name, niche, products_json, audience, tone, language, value_proposition, cta_defaults_json, forbidden_terms_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), workspaceId, ...args],
  );
}

export type ProjectRow = {
  id: string;
  workspaceId: string;
  title: string;
  contentType: string;
  platform: string;
  goal: string;
  language: string;
  task: TaskInput;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function mapProject(row: Record<string, unknown>): ProjectRow {
  const task = parseJson<Partial<TaskInput>>(text(row, "task_json"), {});
  return {
    id: text(row, "id"),
    workspaceId: text(row, "workspace_id"),
    title: text(row, "title"),
    contentType: text(row, "content_type"),
    platform: text(row, "platform"),
    goal: text(row, "goal"),
    language: text(row, "language"),
    status: text(row, "status"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    task: {
      contentType: task.contentType || text(row, "content_type"),
      platform: task.platform || text(row, "platform"),
      goal: task.goal || text(row, "goal"),
      language: task.language || text(row, "language"),
      topic: task.topic || "",
      tone: task.tone || "",
      audience: task.audience || "",
      constraints: task.constraints || [],
      useKnowledgeBase: task.useKnowledgeBase !== false,
    },
  };
}

export async function listProjects(workspaceId: string, query: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const like = `%${query.replaceAll("%", "")}%`;
  const rows = await queryMany(
    `SELECT * FROM projects
     WHERE workspace_id = ? AND (? = '' OR title LIKE ?)
     ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, query, like, limit, offset],
  );
  const countRow = await queryOne(
    `SELECT COUNT(*) AS count FROM projects WHERE workspace_id = ? AND (? = '' OR title LIKE ?)`,
    [workspaceId, query, like],
  );
  return { items: rows.map(mapProject), total: countRow ? num(countRow, "count") : 0 };
}

export async function findProject(workspaceId: string, projectId: string) {
  const row = await queryOne("SELECT * FROM projects WHERE id = ? AND workspace_id = ?", [projectId, workspaceId]);
  return row ? mapProject(row) : null;
}

export async function insertProject(input: {
  id: string;
  workspaceId: string;
  title: string;
  task: TaskInput;
}) {
  const stamp = nowIso();
  await execute(
    `INSERT INTO projects
      (id, workspace_id, title, content_type, platform, goal, language, task_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      input.id,
      input.workspaceId,
      input.title,
      input.task.contentType,
      input.task.platform,
      input.task.goal,
      input.task.language,
      JSON.stringify(input.task),
      stamp,
      stamp,
    ],
  );
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  patch: { title?: string; status?: string; task?: TaskInput },
) {
  const current = await findProject(workspaceId, projectId);
  if (!current) return;
  await execute(
    `UPDATE projects SET title = ?, status = ?, task_json = ?, content_type = ?, platform = ?, goal = ?, language = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [
      patch.title ?? current.title,
      patch.status ?? current.status,
      JSON.stringify(patch.task ?? current.task),
      patch.task?.contentType ?? current.contentType,
      patch.task?.platform ?? current.platform,
      patch.task?.goal ?? current.goal,
      patch.task?.language ?? current.language,
      nowIso(),
      projectId,
      workspaceId,
    ],
  );
}

export async function deleteProject(workspaceId: string, projectId: string) {
  const assets = await queryMany(
    `SELECT storage_key FROM assets WHERE project_id IN (SELECT id FROM projects WHERE id = ? AND workspace_id = ?)`,
    [projectId, workspaceId],
  );
  await execute("DELETE FROM projects WHERE id = ? AND workspace_id = ?", [projectId, workspaceId]);
  return assets.map((row) => text(row, "storage_key")).filter(Boolean);
}

export type VersionRow = {
  id: string;
  projectId: string;
  parentVersionId: string | null;
  promptSummary: string;
  content: ContentResult;
  sources: SourceRef[];
  modelId: string;
  status: string;
  createdAt: string;
};

function mapVersion(row: Record<string, unknown>): VersionRow {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    parentVersionId: nullable(row, "parent_version_id"),
    promptSummary: text(row, "prompt_summary"),
    content: parseJson<ContentResult>(text(row, "content_json"), {
      title: "",
      hook: "",
      body: "",
      cta: "",
      hashtags: [],
      visualPrompt: "",
      notesToVerify: [],
      language: "ru",
      format: "",
      variantLabel: "",
    }),
    sources: parseJson<SourceRef[]>(text(row, "sources_json"), []),
    modelId: text(row, "model_id"),
    status: text(row, "generation_status"),
    createdAt: text(row, "created_at"),
  };
}

export async function listVersions(projectId: string) {
  const rows = await queryMany(
    "SELECT * FROM content_versions WHERE project_id = ? ORDER BY created_at ASC",
    [projectId],
  );
  return rows.map(mapVersion);
}

export async function findVersion(projectId: string, versionId: string) {
  const row = await queryOne("SELECT * FROM content_versions WHERE id = ? AND project_id = ?", [versionId, projectId]);
  return row ? mapVersion(row) : null;
}

export async function insertVersion(input: {
  id: string;
  projectId: string;
  parentVersionId: string | null;
  promptSummary: string;
  content: ContentResult;
  sources: SourceRef[];
  modelId: string;
  status: string;
}) {
  await execute(
    `INSERT INTO content_versions
      (id, project_id, parent_version_id, prompt_summary, content_json, sources_json, model_id, generation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.projectId,
      input.parentVersionId,
      input.promptSummary.slice(0, 500),
      JSON.stringify(input.content),
      JSON.stringify(input.sources),
      input.modelId,
      input.status,
      nowIso(),
    ],
  );
}

export type AssetRow = {
  id: string;
  projectId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  modelId: string;
  promptSummary: string;
  status: string;
  errorMessage: string;
  createdAt: string;
};

function mapAsset(row: Record<string, unknown>): AssetRow {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    storageKey: text(row, "storage_key"),
    mimeType: text(row, "mime_type"),
    sizeBytes: num(row, "size_bytes"),
    width: row.width == null ? null : num(row, "width"),
    height: row.height == null ? null : num(row, "height"),
    modelId: text(row, "model_id"),
    promptSummary: text(row, "prompt_summary"),
    status: text(row, "status"),
    errorMessage: text(row, "error_message"),
    createdAt: text(row, "created_at"),
  };
}

export async function listAssets(projectId: string) {
  const rows = await queryMany("SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC", [projectId]);
  return rows.map(mapAsset);
}

export async function findAssetForWorkspace(workspaceId: string, assetId: string) {
  const row = await queryOne(
    `SELECT a.* FROM assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = ? AND p.workspace_id = ?`,
    [assetId, workspaceId],
  );
  return row ? mapAsset(row) : null;
}

export async function insertAsset(input: {
  id: string;
  projectId: string;
  modelId: string;
  promptSummary: string;
  status: string;
}) {
  await execute(
    `INSERT INTO assets
      (id, project_id, storage_key, mime_type, size_bytes, model_id, prompt_summary, status, error_message, created_at)
     VALUES (?, ?, '', 'image/png', 0, ?, ?, ?, '', ?)`,
    [input.id, input.projectId, input.modelId, input.promptSummary.slice(0, 500), input.status, nowIso()],
  );
}

export async function updateAsset(
  id: string,
  patch: {
    storageKey?: string;
    mimeType?: string;
    sizeBytes?: number;
    width?: number | null;
    height?: number | null;
    status?: string;
    errorMessage?: string;
  },
) {
  const row = await queryOne("SELECT * FROM assets WHERE id = ?", [id]);
  if (!row) return;
  const current = mapAsset(row);
  await execute(
    `UPDATE assets
     SET storage_key = ?, mime_type = ?, size_bytes = ?, width = ?, height = ?, status = ?, error_message = ?
     WHERE id = ?`,
    [
      patch.storageKey ?? current.storageKey,
      patch.mimeType ?? current.mimeType,
      patch.sizeBytes ?? current.sizeBytes,
      patch.width === undefined ? current.width : patch.width,
      patch.height === undefined ? current.height : patch.height,
      patch.status ?? current.status,
      patch.errorMessage ?? current.errorMessage,
      id,
    ],
  );
}

export const CHUNKS_SQL = `SELECT c.id, c.document_id, c.workspace_id, c.chunk_index, c.text, c.page_number,
       c.embedding_json, c.embedding_model, d.title AS document_title
     FROM knowledge_chunks c
     JOIN knowledge_documents d ON d.id = c.document_id
     WHERE c.workspace_id = ? AND d.workspace_id = ? AND d.status = 'ready'
     ORDER BY c.created_at DESC
     LIMIT ?`;

export type ChunkRow = {
  id: string;
  documentId: string;
  workspaceId: string;
  chunkIndex: number;
  text: string;
  pageNumber: number | null;
  embedding: number[] | null;
  embeddingModel: string | null;
  documentTitle: string;
};

export async function listChunksForWorkspace(workspaceId: string, limit: number) {
  const rows = await queryMany(CHUNKS_SQL, [workspaceId, workspaceId, limit]);
  return rows.map((row) => ({
    id: text(row, "id"),
    documentId: text(row, "document_id"),
    workspaceId: text(row, "workspace_id"),
    chunkIndex: num(row, "chunk_index"),
    text: text(row, "text"),
    pageNumber: row.page_number == null ? null : num(row, "page_number"),
    embedding: row.embedding_json ? parseJson<number[] | null>(text(row, "embedding_json"), null) : null,
    embeddingModel: nullable(row, "embedding_model"),
    documentTitle: text(row, "document_title"),
  }));
}

export async function replaceChunks(
  documentId: string,
  chunks: Array<{
    id: string;
    workspaceId: string;
    chunkIndex: number;
    text: string;
    pageNumber: number | null;
    embedding: number[] | null;
    embeddingModel: string | null;
    pipelineVersion: string;
  }>,
) {
  await executeBatch([
    { sql: "DELETE FROM knowledge_chunks WHERE document_id = ?", args: [documentId] },
    ...chunks.map((chunk) => ({
      sql: `INSERT INTO knowledge_chunks
        (id, document_id, workspace_id, chunk_index, text, page_number, embedding_json, embedding_model, pipeline_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        chunk.id,
        documentId,
        chunk.workspaceId,
        chunk.chunkIndex,
        chunk.text,
        chunk.pageNumber,
        chunk.embedding ? JSON.stringify(chunk.embedding) : null,
        chunk.embeddingModel,
        chunk.pipelineVersion,
        nowIso(),
      ] as InValue[],
    })),
  ]);
}

export type DocumentRow = {
  id: string;
  workspaceId: string;
  title: string;
  sourceType: string;
  storageKey: string | null;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  errorMessage: string;
  indexNote: string;
  contentHash: string;
  extractedText: string;
  createdAt: string;
  updatedAt: string;
};

function mapDocument(row: Record<string, unknown>): DocumentRow {
  return {
    id: text(row, "id"),
    workspaceId: text(row, "workspace_id"),
    title: text(row, "title"),
    sourceType: text(row, "source_type"),
    storageKey: nullable(row, "storage_key"),
    mimeType: text(row, "mime_type"),
    sizeBytes: num(row, "size_bytes"),
    status: text(row, "status"),
    errorCode: nullable(row, "extraction_error_code"),
    errorMessage: text(row, "error_message"),
    indexNote: text(row, "index_note"),
    contentHash: text(row, "content_hash"),
    extractedText: text(row, "extracted_text"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

export async function listDocuments(workspaceId: string) {
  const rows = await queryMany(
    `SELECT d.id, d.workspace_id, d.title, d.source_type, d.mime_type, d.size_bytes, d.status,
            d.extraction_error_code, d.error_message, d.index_note, d.created_at, d.updated_at,
            (SELECT COUNT(*) FROM knowledge_chunks c WHERE c.document_id = d.id) AS chunk_count
     FROM knowledge_documents d
     WHERE d.workspace_id = ?
     ORDER BY d.created_at DESC`,
    [workspaceId],
  );
  return rows.map((row) => ({
    id: text(row, "id"),
    title: text(row, "title"),
    sourceType: text(row, "source_type"),
    mimeType: text(row, "mime_type"),
    sizeBytes: num(row, "size_bytes"),
    status: text(row, "status"),
    errorCode: nullable(row, "extraction_error_code"),
    errorMessage: text(row, "error_message"),
    indexNote: text(row, "index_note"),
    chunkCount: num(row, "chunk_count"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  }));
}

export async function findDocument(workspaceId: string, documentId: string) {
  const row = await queryOne(
    "SELECT * FROM knowledge_documents WHERE id = ? AND workspace_id = ?",
    [documentId, workspaceId],
  );
  return row ? mapDocument(row) : null;
}

export async function insertDocument(input: {
  id: string;
  workspaceId: string;
  title: string;
  sourceType: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
}) {
  const stamp = nowIso();
  await execute(
    `INSERT INTO knowledge_documents
      (id, workspace_id, title, source_type, storage_key, mime_type, size_bytes, status, error_message, index_note, content_hash, extracted_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', '', '', '', '', ?, ?)`,
    [input.id, input.workspaceId, input.title, input.sourceType, input.storageKey, input.mimeType, input.sizeBytes, stamp, stamp],
  );
}

export async function updateDocument(
  workspaceId: string,
  documentId: string,
  patch: Partial<{
    status: string;
    errorCode: string | null;
    errorMessage: string;
    indexNote: string;
    contentHash: string;
    extractedText: string;
    storageKey: string | null;
  }>,
) {
  const current = await findDocument(workspaceId, documentId);
  if (!current) return;
  await execute(
    `UPDATE knowledge_documents
     SET status = ?, extraction_error_code = ?, error_message = ?, index_note = ?, content_hash = ?, extracted_text = ?, storage_key = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [
      patch.status ?? current.status,
      patch.errorCode === undefined ? current.errorCode : patch.errorCode,
      patch.errorMessage ?? current.errorMessage,
      patch.indexNote ?? current.indexNote,
      patch.contentHash ?? current.contentHash,
      patch.extractedText ?? current.extractedText,
      patch.storageKey === undefined ? current.storageKey : patch.storageKey,
      nowIso(),
      documentId,
      workspaceId,
    ],
  );
}

export async function deleteDocument(workspaceId: string, documentId: string) {
  const current = await findDocument(workspaceId, documentId);
  if (!current) return null;
  await execute("DELETE FROM knowledge_documents WHERE id = ? AND workspace_id = ?", [documentId, workspaceId]);
  return current;
}

export async function countUsage(userId: string, operations: string[], status: string, sinceIso: string) {
  if (operations.length === 0) return 0;
  const marks = operations.map(() => "?").join(", ");
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM usage_events
     WHERE user_id = ? AND status = ? AND created_at >= ? AND operation IN (${marks})`,
    [userId, status, sinceIso, ...operations],
  );
  return row ? num(row, "count") : 0;
}

export async function insertUsage(input: {
  id: string;
  userId: string;
  workspaceId: string | null;
  projectId: string | null;
  operation: string;
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  status: string;
  requestId: string;
  errorCode: string | null;
}) {
  await execute(
    `INSERT INTO usage_events
      (id, user_id, workspace_id, project_id, operation, model_id, input_tokens, output_tokens, estimated_cost, status, request_id, error_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.userId,
      input.workspaceId,
      input.projectId,
      input.operation,
      input.modelId,
      input.inputTokens,
      input.outputTokens,
      input.estimatedCost,
      input.status,
      input.requestId,
      input.errorCode,
      nowIso(),
    ],
  );
}

export async function recentFailures(limit = 30) {
  const rows = await queryMany(
    `SELECT operation, model_id, status, error_code, request_id, created_at
     FROM usage_events WHERE status != 'success'
     ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    operation: text(row, "operation"),
    modelId: text(row, "model_id"),
    status: text(row, "status"),
    errorCode: nullable(row, "error_code"),
    requestId: text(row, "request_id"),
    createdAt: text(row, "created_at"),
  }));
}

export async function usageSummary() {
  const rows = await queryMany(
    `SELECT operation, status, COUNT(*) AS count
     FROM usage_events GROUP BY operation, status ORDER BY operation`,
  );
  return rows.map((row) => ({
    operation: text(row, "operation"),
    status: text(row, "status"),
    count: num(row, "count"),
  }));
}

export async function insertAudit(actorId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
  await execute(
    `INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id, minimal_metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), actorId, action, resourceType, resourceId, JSON.stringify(metadata), nowIso()],
  );
}

export async function insertProductEvent(userId: string, eventType: string, projectId: string | null, metadata: Record<string, unknown> = {}) {
  await execute(
    `INSERT INTO product_events (id, user_id, event_type, project_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), userId, eventType, projectId, JSON.stringify(metadata), nowIso()],
  );
}

export async function getSettings() {
  const rows = await queryMany("SELECT key, value_json FROM system_settings");
  const map: Record<string, number> = {};
  for (const row of rows) {
    const parsed = parseJson<number>(text(row, "value_json"), Number.NaN);
    if (Number.isFinite(parsed)) map[text(row, "key")] = parsed;
  }
  return map;
}

export async function setSetting(key: string, value: number) {
  await execute(
    `INSERT INTO system_settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), nowIso()],
  );
}

export async function readIdempotency(userId: string, route: string, key: string) {
  return queryOne(
    "SELECT status, response_json, created_at FROM idempotency_keys WHERE user_id = ? AND route = ? AND idem_key = ?",
    [userId, route, key],
  );
}

export async function claimIdempotency(userId: string, route: string, key: string) {
  await execute(
    `INSERT INTO idempotency_keys (user_id, route, idem_key, status, response_json, created_at) VALUES (?, ?, ?, 'pending', NULL, ?)`,
    [userId, route, key, nowIso()],
  );
}

export async function finishIdempotency(userId: string, route: string, key: string, response: unknown) {
  await execute(
    `UPDATE idempotency_keys SET status = 'done', response_json = ? WHERE user_id = ? AND route = ? AND idem_key = ?`,
    [JSON.stringify(response), userId, route, key],
  );
}

export async function releaseIdempotency(userId: string, route: string, key: string) {
  await execute("DELETE FROM idempotency_keys WHERE user_id = ? AND route = ? AND idem_key = ?", [userId, route, key]);
}

export async function deleteUserData(userId: string) {
  const workspace = await findWorkspaceByOwner(userId);
  const keys: string[] = [];
  if (workspace) {
    const assetRows = await queryMany(
      `SELECT storage_key FROM assets WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = ?)`,
      [workspace.id],
    );
    const docRows = await queryMany("SELECT storage_key FROM knowledge_documents WHERE workspace_id = ?", [workspace.id]);
    keys.push(...assetRows.map((row) => text(row, "storage_key")), ...docRows.map((row) => text(row, "storage_key")));
  }
  await execute("DELETE FROM users WHERE id = ?", [userId]);
  return keys.filter(Boolean);
}
