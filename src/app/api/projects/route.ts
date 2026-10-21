import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { parseInput, projectCreateSchema } from "@/lib/ai/schemas";
import { insertProject, listProjects, newId } from "@/lib/db/repo";
import { requireWorkspace } from "@/lib/services/account";

export const runtime = "nodejs";

export const GET = withHandler(async (request) => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const query = (url.searchParams.get("query") || "").slice(0, 120);
  return json(await listProjects(workspace.id, query, page, limit));
});

export const POST = withHandler(async (request) => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  const body = parseInput(projectCreateSchema, await readJson(request));
  const id = newId();
  const title = body.title?.trim() || body.topic.slice(0, 80);
  await insertProject({
    id,
    workspaceId: workspace.id,
    title,
    task: {
      contentType: body.contentType,
      platform: body.platform,
      goal: body.goal,
      language: body.language,
      topic: body.topic,
      tone: body.tone,
      audience: body.audience,
      constraints: body.constraints,
      useKnowledgeBase: body.useKnowledgeBase,
    },
  });
  return json({ id, title }, 201);
});
