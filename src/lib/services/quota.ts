import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { countUsage, getSettings } from "@/lib/db/repo";
import { isOverQuota, startOfUtcDay } from "@/lib/content/format";
import { queryOne } from "@/lib/db/client";

export const TEXT_OPERATIONS = ["text_generate", "text_edit", "text_variants"];

export async function currentLimits() {
  const settings = await getSettings();
  return {
    textDaily: settings.text_daily ?? config.textDaily,
    imageDaily: settings.image_daily ?? config.imageDaily,
    uploadDaily: settings.upload_daily ?? config.uploadDaily,
    embedDaily: settings.embed_daily ?? config.embedDaily,
    ratePerMinute: settings.rate_per_minute ?? config.ratePerMinute,
  };
}

async function countRecent(userId: string, sinceIso: string) {
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM usage_events
     WHERE user_id = ? AND created_at >= ?
       AND operation IN ('text_generate', 'text_edit', 'text_variants', 'image_generate', 'kb_index')`,
    [userId, sinceIso],
  );
  return row ? Number(row.count ?? 0) : 0;
}

export async function assertRate(userId: string) {
  const limits = await currentLimits();
  const used = await countRecent(userId, new Date(Date.now() - 60_000).toISOString());
  if (used >= limits.ratePerMinute) {
    throw new AppError("Слишком много запросов за минуту. Подождите немного.", 429, "RATE_LIMIT", true);
  }
}

export async function assertQuota(userId: string, bucket: "text" | "image" | "upload" | "embed") {
  const limits = await currentLimits();
  const since = startOfUtcDay();
  const spec = {
    text: { ops: TEXT_OPERATIONS, limit: limits.textDaily, message: "Дневной лимит текстовых генераций исчерпан." },
    image: { ops: ["image_generate"], limit: limits.imageDaily, message: "Дневной лимит изображений исчерпан." },
    upload: { ops: ["kb_upload"], limit: limits.uploadDaily, message: "Дневной лимит загрузки источников исчерпан." },
    embed: { ops: ["kb_index"], limit: limits.embedDaily, message: "Дневной лимит индексации исчерпан." },
  }[bucket];
  const used = await countUsage(userId, spec.ops, "success", since);
  if (isOverQuota(used, spec.limit)) {
    throw new AppError(spec.message, 429, "QUOTA_EXCEEDED");
  }
}

export async function quotaSnapshot(userId: string) {
  const limits = await currentLimits();
  const since = startOfUtcDay();
  const [text, image, upload] = await Promise.all([
    countUsage(userId, TEXT_OPERATIONS, "success", since),
    countUsage(userId, ["image_generate"], "success", since),
    countUsage(userId, ["kb_upload"], "success", since),
  ]);
  return {
    text: { used: text, limit: limits.textDaily },
    image: { used: image, limit: limits.imageDaily },
    upload: { used: upload, limit: limits.uploadDaily },
  };
}
