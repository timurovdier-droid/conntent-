import { json, requireUser, withHandler } from "@/lib/http";
import { findAssetForWorkspace } from "@/lib/db/repo";
import { requireWorkspace } from "@/lib/services/account";

export const runtime = "nodejs";

export const GET = withHandler(async (_request, context) => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  const { id } = await context.params;
  const asset = await findAssetForWorkspace(workspace.id, id);
  if (!asset) return json({ error: { code: "NOT_FOUND", message: "Файл не найден.", requestId: crypto.randomUUID(), retryable: false } }, 404);
  return json({
    id: asset.id,
    status: asset.status,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    errorMessage: asset.errorMessage,
    createdAt: asset.createdAt,
    downloadUrl: asset.status === "ready" ? `/api/assets/${asset.id}/file` : null,
  });
});
