import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { parseInput, projectPatchSchema } from "@/lib/ai/schemas";
import { updateProject } from "@/lib/db/repo";
import { ownedProject, projectPayload, removeProject } from "@/lib/services/content";

export const runtime = "nodejs";

export const GET = withHandler(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  return json(await projectPayload(user.id, id));
});

export const PATCH = withHandler(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = parseInput(projectPatchSchema, await readJson(request));
  const { workspace } = await ownedProject(user.id, id);
  await updateProject(workspace.id, id, { title: body.title });
  return json({ ok: true });
});

export const DELETE = withHandler(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await removeProject(user, id);
  return json({ ok: true });
});
