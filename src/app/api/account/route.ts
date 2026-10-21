import { readJson, json, requireUser, withHandler } from "@/lib/http";
import { accountPatchSchema, deleteAccountSchema, parseInput } from "@/lib/ai/schemas";
import { clearSessionCookie } from "@/lib/http";
import { deleteAccount, mePayload } from "@/lib/services/account";
import { updateUser } from "@/lib/db/repo";

export const runtime = "nodejs";

export const PATCH = withHandler(async (request) => {
  const user = await requireUser();
  const body = parseInput(accountPatchSchema, await readJson(request));
  await updateUser(user.id, { locale: body.locale });
  const next = { ...user, locale: body.locale };
  return json(await mePayload(next));
});

export const DELETE = withHandler(async (request) => {
  const user = await requireUser();
  const body = parseInput(deleteAccountSchema, await readJson(request));
  await deleteAccount(user, body.password);
  await clearSessionCookie();
  return json({ ok: true });
});
