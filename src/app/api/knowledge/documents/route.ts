import { json, requireUser, withHandler } from "@/lib/http";
import { noteSchema, parseInput } from "@/lib/ai/schemas";
import { addFile, addNote, documentsFor } from "@/lib/services/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = withHandler(async () => {
  const user = await requireUser();
  return json({ documents: await documentsFor(user.id) });
});

export const POST = withHandler(async (request, _context, requestId) => {
  const user = await requireUser();
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: { code: "VALIDATION", message: "Приложите файл.", requestId, retryable: false } }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await addFile(user, file.name || "document.txt", bytes, requestId);
    return json({ document }, 201);
  }
  const body = parseInput(noteSchema, await request.json().catch(() => ({})));
  const document = await addNote(user, body.title, body.text, requestId);
  return json({ document }, 201);
});
