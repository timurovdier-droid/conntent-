import { json, requireUser, withHandler } from "@/lib/http";
import { documentFor, removeDocument } from "@/lib/services/knowledge";

export const runtime = "nodejs";

export const GET = withHandler(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  return json(await documentFor(user.id, id));
});

export const DELETE = withHandler(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await removeDocument(user, id);
  return json({ ok: true });
});
