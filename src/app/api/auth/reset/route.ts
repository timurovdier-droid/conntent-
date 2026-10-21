import { json, withHandler } from "@/lib/http";
import { parseInput, resetSchema } from "@/lib/ai/schemas";
import { resetPassword } from "@/lib/services/account";

export const runtime = "nodejs";

export const POST = withHandler(async (request) => {
  const body = parseInput(resetSchema, await request.json().catch(() => ({})));
  await resetPassword(body.token, body.password);
  return json({ ok: true });
});
