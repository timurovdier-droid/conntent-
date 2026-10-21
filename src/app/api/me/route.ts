import { json, requireUser, withHandler } from "@/lib/http";
import { mePayload } from "@/lib/services/account";

export const runtime = "nodejs";

export const GET = withHandler(async () => {
  const user = await requireUser();
  return json(await mePayload(user));
});
