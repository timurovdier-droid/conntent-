import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { z } from "zod";
import { parseInput } from "@/lib/ai/schemas";
import { insertProductEvent } from "@/lib/db/repo";

const eventSchema = z.object({
  type: z.enum(["copy", "export"]),
  projectId: z.string().uuid().optional(),
});

export const runtime = "nodejs";

export const POST = withHandler(async (request) => {
  const user = await requireUser();
  const body = parseInput(eventSchema, await readJson(request));
  await insertProductEvent(user.id, body.type, body.projectId ?? null);
  return json({ ok: true });
});
