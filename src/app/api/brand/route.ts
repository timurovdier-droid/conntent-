import { json, requireUser, withHandler } from "@/lib/http";
import { findBrand, saveBrand } from "@/lib/db/repo";
import { brandSchema, parseInput } from "@/lib/ai/schemas";
import { readJson } from "@/lib/http";
import { requireWorkspace } from "@/lib/services/account";

export const runtime = "nodejs";

export const GET = withHandler(async () => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  return json(await findBrand(workspace.id));
});

export const PUT = withHandler(async (request) => {
  const user = await requireUser();
  const workspace = await requireWorkspace(user.id);
  const brand = parseInput(brandSchema, await readJson(request));
  await saveBrand(workspace.id, brand);
  return json(brand);
});
