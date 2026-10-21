import type { ContentResult, SourceRef } from "@/lib/types";

export function contentToPlain(content: ContentResult, sources: SourceRef[] = []) {
  const lines = [
    content.title,
    content.hook,
    content.body,
    content.cta,
    content.hashtags.length ? content.hashtags.map((tag) => `#${tag}`).join(" ") : "",
  ].filter(Boolean);
  if (content.notesToVerify.length) {
    lines.push("", "Проверить перед публикацией:", ...content.notesToVerify.map((note) => `- ${note}`));
  }
  if (sources.length) {
    lines.push("", "Использованные источники:", ...sources.map((source) => `- ${source.title}${source.page ? `, стр. ${source.page}` : ""}`));
  }
  return lines.join("\n\n");
}

export function contentToMarkdown(content: ContentResult, sources: SourceRef[] = []) {
  const parts = [`# ${content.title}`];
  if (content.hook) parts.push(`> ${content.hook}`);
  parts.push(content.body);
  if (content.cta) parts.push(`**${content.cta}**`);
  if (content.hashtags.length) parts.push(content.hashtags.map((tag) => `#${tag}`).join(" "));
  if (content.notesToVerify.length) {
    parts.push("## Проверить перед публикацией", content.notesToVerify.map((note) => `- ${note}`).join("\n"));
  }
  if (sources.length) {
    parts.push(
      "## Использованные источники",
      sources.map((source) => `- ${source.title}${source.page ? `, стр. ${source.page}` : ""}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function isOverQuota(used: number, limit: number) {
  return used >= limit;
}

export function countsTowardQuota(status: string) {
  return status === "success";
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

export function safeFilename(value: string) {
  const clean = value.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim().slice(0, 80);
  return clean || "contentpilot";
}

export function imageSize(bytes: Uint8Array) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  return { width: null as number | null, height: null as number | null };
}
