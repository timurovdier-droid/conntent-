import { requireUser, withHandler } from "@/lib/http";
import { safeFilename } from "@/lib/content/format";
import { readAssetFile } from "@/lib/services/content";
import { findProject } from "@/lib/db/repo";
import { requireWorkspace } from "@/lib/services/account";

export const runtime = "nodejs";

export const GET = withHandler(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const file = await readAssetFile(user.id, id);
  const workspace = await requireWorkspace(user.id);
  const project = await findProject(workspace.id, file.asset.projectId);
  const filename = `${safeFilename(project?.title || "image")}.${file.asset.mimeType.includes("jpeg") ? "jpg" : "png"}`;
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.asset.mimeType || "image/png",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
