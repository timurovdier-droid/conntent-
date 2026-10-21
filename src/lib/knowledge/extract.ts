export async function extractPieces(kind: "pdf" | "docx" | "text", bytes: Uint8Array) {
  if (kind === "text") {
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("ENCODING");
    }
    return [{ page: null as number | null, text }];
  }
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return [{ page: null as number | null, text: result.value || "" }];
  }
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  return pages.map((page, index) => ({ page: index + 1, text: String(page ?? "") }));
}
