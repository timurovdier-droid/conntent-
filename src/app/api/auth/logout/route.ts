import { clearSessionCookie, json, withHandler } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withHandler(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
