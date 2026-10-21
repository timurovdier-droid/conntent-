import { json, setSessionCookie, withHandler } from "@/lib/http";
import { loginSchema, parseInput } from "@/lib/ai/schemas";
import { loginAccount, mePayload, sessionFor } from "@/lib/services/account";

export const runtime = "nodejs";

export const POST = withHandler(async (request) => {
  const body = parseInput(loginSchema, await request.json().catch(() => ({})));
  const user = await loginAccount(body.email, body.password);
  await setSessionCookie(await sessionFor(user));
  return json(await mePayload(user));
});
