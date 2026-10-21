import { idempotencyKey, json, readJson, requireUser, withHandler } from "@/lib/http";
import { editSchema, parseInput } from "@/lib/ai/schemas";
import { editDraft } from "@/lib/services/content";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withHandler(async (request, context, requestId) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = parseInput(editSchema, await readJson(request));
  return json(
    await editDraft({
      user,
      projectId: id,
      baseVersionId: body.baseVersionId,
      instruction: body.instruction,
      requestId,
      idempotencyKey: idempotencyKey(request),
      signal: request.signal,
    }),
  );
});
