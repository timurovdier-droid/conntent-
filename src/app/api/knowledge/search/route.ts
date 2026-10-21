import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { z } from "zod";
import { parseInput } from "@/lib/ai/schemas";
import { requireWorkspace } from "@/lib/services/account";
import { retrieveForWorkspace } from "@/lib/services/content";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(8).optional(),
});

export const POST = withHandler(async (request) => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  const body = parseInput(searchSchema, await readJson(request));
  const found = await retrieveForWorkspace(workspace.id, body.query);
  return json({
    mode: found.mode,
    results: found.chunks.slice(0, body.limit ?? 5).map((chunk) => ({
      documentId: chunk.documentId,
      title: chunk.documentTitle,
      chunkId: chunk.id,
      page: chunk.pageNumber,
      excerpt: chunk.text.replace(/\s+/g, " ").slice(0, 280),
    })),
  });
});
