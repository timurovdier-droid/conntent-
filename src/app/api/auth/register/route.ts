import { json, requireUser, setSessionCookie, withHandler } from "@/lib/http";
import { parseInput, registerSchema } from "@/lib/ai/schemas";
import { mePayload, registerAccount, sessionFor } from "@/lib/services/account";

export const runtime = "nodejs";

export const POST = withHandler(async (request) => {
  const body = parseInput(registerSchema, await request.json().catch(() => ({})));
  const user = await registerAccount(body.email, body.password);
  await setSessionCookie(await sessionFor(user));
  return json(await mePayload(user), 201);
});
