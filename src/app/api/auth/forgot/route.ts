import { json, withHandler } from "@/lib/http";
import { forgotSchema, parseInput } from "@/lib/ai/schemas";
import { requestPasswordReset } from "@/lib/services/account";

export const runtime = "nodejs";

export const POST = withHandler(async (request) => {
  const body = parseInput(forgotSchema, await request.json().catch(() => ({})));
  const result = await requestPasswordReset(body.email);
  return json({
    message: "Если аккаунт существует, мы подготовили восстановление доступа.",
    devResetUrl: result.devResetUrl,
  });
});
