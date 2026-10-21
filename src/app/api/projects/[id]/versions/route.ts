import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { manualSchema, parseInput, restoreSchema } from "@/lib/ai/schemas";
import { restoreVersion, saveManual } from "@/lib/services/content";

export const runtime = "nodejs";

export const POST = withHandler(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const raw = await readJson(request);
  if (raw && typeof raw === "object" && "versionId" in raw) {
    const body = parseInput(restoreSchema, raw);
    return json(await restoreVersion(user, id, body.versionId));
  }
  const content = parseInput(manualSchema, raw);
  const baseVersionId = raw && typeof raw === "object" && "baseVersionId" in raw ? String(raw.baseVersionId || "") : "";
  return json(await saveManual({ user, projectId: id, content, baseVersionId: baseVersionId || null }));
});
