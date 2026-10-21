type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.content)) {
    return record.content
      .map((part) => textOf(part))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function readInteractionText(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return "";
  if (typeof record.output_text === "string") return record.output_text;
  if (typeof record.outputText === "string") return record.outputText;
  const parts: string[] = [];
  if (Array.isArray(record.steps)) {
    for (const step of record.steps) {
      const block = asRecord(step);
      if (!block || block.type === "thought") continue;
      const piece = textOf(block);
      if (piece) parts.push(piece);
    }
  }
  const buckets = [record.outputs, record.output];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const piece = textOf(item);
      if (piece) parts.push(piece);
    }
  }
  return parts.join("\n").trim();
}

export function readInteractionImage(payload: unknown): { data: string; mimeType: string } | null {
  const record = asRecord(payload);
  if (!record) return null;
  const direct = asRecord(record.output_image) || asRecord(record.outputImage);
  if (direct && typeof direct.data === "string" && direct.data.length > 0) {
    return {
      data: direct.data,
      mimeType: typeof direct.mime_type === "string" ? direct.mime_type : typeof direct.mimeType === "string" ? direct.mimeType : "image/png",
    };
  }
  const buckets = [record.outputs, record.steps, record.output];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const block = asRecord(item);
      if (!block) continue;
      const image = asRecord(block.image) || asRecord(block.output_image) || block;
      if (typeof image?.data === "string" && (block.type === "image" || image.mime_type || image.mimeType || image.data.length > 100)) {
        return {
          data: image.data,
          mimeType: typeof image.mime_type === "string" ? image.mime_type : typeof image.mimeType === "string" ? image.mimeType : "image/png",
        };
      }
    }
  }
  return null;
}

export function readUsage(payload: unknown) {
  const record = asRecord(payload);
  const usage = asRecord(record?.usage) || asRecord(record?.usageMetadata) || {};
  const input = Number(usage.input_tokens ?? usage.promptTokenCount ?? usage.inputTokens);
  const output = Number(usage.output_tokens ?? usage.candidatesTokenCount ?? usage.outputTokens);
  return {
    inputTokens: Number.isFinite(input) ? input : null,
    outputTokens: Number.isFinite(output) ? output : null,
  };
}

export function readEmbeddingValues(payload: unknown): number[] | null {
  const record = asRecord(payload);
  if (!record) return null;
  const embedding = asRecord(record.embedding);
  const list = embedding?.values ?? (Array.isArray(record.embeddings) ? asRecord(record.embeddings[0])?.values : null);
  if (!Array.isArray(list) || !list.every((item) => typeof item === "number")) return null;
  return list as number[];
}

export function interactionFailed(payload: unknown) {
  const record = asRecord(payload);
  const status = typeof record?.status === "string" ? record.status : "";
  return status === "failed" || status === "cancelled" || status === "incomplete";
}
