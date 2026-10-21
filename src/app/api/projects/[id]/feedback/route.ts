import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { feedbackSchema, parseInput } from "@/lib/ai/schemas";
import { insertProductEvent } from "@/lib/db/repo";
import { ownedProject } from "@/lib/services/content";

export const runtime = "nodejs";

export const POST = withHandler(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await ownedProject(user.id, id);
  const body = parseInput(feedbackSchema, await readJson(request));
  await insertProductEvent(user.id, "feedback", id, { score: body.score, reason: body.reason });
  return json({ ok: true });
});
