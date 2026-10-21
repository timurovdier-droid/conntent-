import { idempotencyKey, json, readJson, requireUser, withHandler } from "@/lib/http";
import { generateSchema, parseInput } from "@/lib/ai/schemas";
import { generateDraft } from "@/lib/services/content";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withHandler(async (request, _context, requestId) => {
  const user = await requireUser();
  const body = parseInput(generateSchema, await readJson(request));
  const result = await generateDraft({
    user,
    projectId: body.projectId,
    task: {
      contentType: body.contentType,
      platform: body.platform,
      goal: body.goal,
      language: body.language,
      topic: body.topic,
      tone: body.tone,
      audience: body.audience,
      constraints: body.constraints,
      useKnowledgeBase: body.useKnowledgeBase,
    },
    requestId,
    idempotencyKey: idempotencyKey(request),
    signal: request.signal,
  });
  return json(result);
});
