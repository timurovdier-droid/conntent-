import { json, requireUser, withHandler } from "@/lib/http";
import { reindexDocument } from "@/lib/services/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withHandler(async (_request, context, requestId) => {
  const user = await requireUser();
  const { id } = await context.params;
  return json({ document: await reindexDocument(user, id, requestId) });
});
