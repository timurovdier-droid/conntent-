import { idempotencyKey, json, readJson, requireUser, withHandler } from "@/lib/http";
import { assetSchema, parseInput } from "@/lib/ai/schemas";
import { createVisual } from "@/lib/services/content";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withHandler(async (request, context, requestId) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = parseInput(assetSchema, await readJson(request));
  return json(
    await createVisual({
      user,
      projectId: id,
      versionId: body.versionId,
      note: body.note,
      requestId,
      idempotencyKey: idempotencyKey(request),
      signal: request.signal,
    }),
  );
});
