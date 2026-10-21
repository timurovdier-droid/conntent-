export type TextPiece = { page: number | null; text: string };
export type TextChunk = { text: string; page: number | null };

export function chunkDocument(pieces: TextPiece[], targetChars = 3200, overlapChars = 400): TextChunk[] {
  const chunks: TextChunk[] = [];
  let buffer = "";
  let page: number | null = null;
  const step = Math.max(1, targetChars - overlapChars);

  const flush = () => {
    const clean = buffer.replace(/\u0000/g, "").trim();
    buffer = "";
    if (!clean) return;
    if (clean.length <= targetChars) {
      chunks.push({ text: clean, page });
      return;
    }
    for (let index = 0; index < clean.length; index += step) {
      const slice = clean.slice(index, index + targetChars).trim();
      if (slice) chunks.push({ text: slice, page });
      if (index + targetChars >= clean.length) break;
    }
  };

  for (const piece of pieces) {
    const text = piece.text.replace(/\u0000/g, "").replace(/\r/g, "").trim();
    if (!text) continue;
    for (const paragraph of text.split(/\n{2,}/)) {
      const block = paragraph.trim();
      if (!block) continue;
      if (!buffer) page = piece.page;
      const next = buffer ? `${buffer}\n\n${block}` : block;
      if (next.length > targetChars && buffer) {
        const tail = buffer.slice(Math.max(0, buffer.length - overlapChars));
        flush();
        buffer = `${tail}\n\n${block}`.trim();
        page = piece.page;
        if (buffer.length > targetChars) flush();
      } else {
        buffer = next;
        if (buffer.length > targetChars) flush();
      }
    }
  }
  flush();
  return chunks;
}

export function detectKind(filename: string, bytes: Uint8Array): "pdf" | "docx" | "text" | null {
  const extension = filename.toLowerCase().split(".").pop() || "";
  const looksPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const looksZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (extension === "pdf" && looksPdf) return "pdf";
  if (extension === "docx" && looksZip) return "docx";
  if ((extension === "txt" || extension === "md") && !looksPdf && !looksZip) return "text";
  return null;
}
