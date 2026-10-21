function intEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function strEnv(name: string, fallback: string) {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

export const config = {
  textModel: strEnv("GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
  imageModel: strEnv("GEMINI_IMAGE_MODEL", "gemini-nano-banana-2.1"),
  embeddingModel: strEnv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
  embeddingDimensions: intEnv("EMBEDDING_DIMENSIONS", 768),
  textDaily: intEnv("TEXT_DAILY_QUOTA", 40),
  imageDaily: intEnv("IMAGE_DAILY_QUOTA", 8),
  uploadDaily: intEnv("UPLOAD_DAILY_QUOTA", 20),
  embedDaily: intEnv("EMBED_DAILY_QUOTA", 200),
  ratePerMinute: intEnv("RATE_PER_MINUTE", 10),
  maxUploadBytes: intEnv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
  appUrl: strEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  pipelineVersion: "kb-v1",
  textTimeoutMs: 28_000,
  imageTimeoutMs: 55_000,
  embedTimeoutMs: 20_000,
  extractTimeoutMs: 20_000,
  maxExtractedChars: 200_000,
  maxChunks: 80,
  retrievalLimit: 5,
  retrievalScanLimit: 500,
  maxKnowledgeChars: 8_000,
};

export function pipelineStamp() {
  return `${config.pipelineVersion}:${config.embeddingModel}:${config.embeddingDimensions}`;
}

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
