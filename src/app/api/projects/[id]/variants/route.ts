import { idempotencyKey, json, readJson, requireUser, withHandler } from "@/lib/http";
import { parseInput, variantSchema } from "@/lib/ai/schemas";
import { createVariants } from "@/lib/services/content";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withHandler(async (request, context, requestId) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = parseInput(variantSchema, await readJson(request));
  return json(
    await createVariants({
      user,
      projectId: id,
      baseVersionId: body.baseVersionId,
      requestId,
      idempotencyKey: idempotencyKey(request),
      signal: request.signal,
    }),
  );
});
