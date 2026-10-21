import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ContentResult } from "@/lib/types";

const list = (max: number, itemMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max).optional().default([]);

export const registerSchema = z.object({
  email: z.string().trim().email("Укажите корректный email.").max(200),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов.").max(200),
  consent: z.literal(true, { errorMap: () => ({ message: "Нужно согласие с условиями и политикой." }) }),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Укажите корректный email."),
  password: z.string().min(1, "Введите пароль.").max(200),
});

export const forgotSchema = z.object({
  email: z.string().trim().email("Укажите корректный email."),
});

export const resetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов.").max(200),
});

const fieldText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: не больше ${max} символов.`).optional().default("");

export const brandSchema = z.object({
  name: fieldText(200, "Название"),
  niche: fieldText(500, "Ниша"),
  products: list(40, 500),
  audience: fieldText(4000, "Аудитория"),
  tone: fieldText(400, "Тон"),
  language: z.enum(["ru", "uz", "en"]).optional().default("ru"),
  valueProposition: fieldText(8000, "Чем вы полезны"),
  ctaDefaults: list(20, 300),
  forbiddenTerms: list(40, 120),
});

export const taskSchema = z.object({
  contentType: z.enum(["social_post", "ad_copy", "product_description", "short_video_script", "content_plan"]),
  platform: z.enum(["instagram", "tiktok", "youtube_shorts", "telegram", "facebook", "website", "marketplace"]),
  goal: z.enum(["awareness", "leads", "sales", "engagement", "education"]),
  language: z.enum(["ru", "uz", "en"]),
  topic: z.string().trim().min(2, "Опишите тему хотя бы парой слов.").max(4000),
  tone: z.string().trim().max(200).optional().default(""),
  audience: z.string().trim().max(400).optional().default(""),
  constraints: list(20, 200),
  useKnowledgeBase: z.boolean().optional().default(true),
});

export const projectCreateSchema = taskSchema.extend({
  title: z.string().trim().max(180).optional(),
});

export const projectPatchSchema = z.object({
  title: z.string().trim().min(1, "Название не может быть пустым.").max(180),
});

export const generateSchema = taskSchema.extend({
  projectId: z.string().uuid(),
});

export const editSchema = z.object({
  baseVersionId: z.string().uuid(),
  instruction: z.string().trim().min(2, "Напишите, что изменить.").max(2000),
});

export const variantSchema = z.object({
  baseVersionId: z.string().uuid().optional(),
});

export const manualSchema = z.object({
  title: z.string().trim().min(1).max(300),
  hook: z.string().trim().max(1000).optional().default(""),
  body: z.string().trim().min(1).max(20000),
  cta: z.string().trim().max(500).optional().default(""),
  hashtags: list(30, 80),
  visualPrompt: z.string().trim().max(2000).optional().default(""),
  notesToVerify: list(20, 500),
  language: z.string().trim().max(12).optional().default("ru"),
  format: z.string().trim().max(40).optional().default(""),
  variantLabel: z.string().trim().max(120).optional().default("Правка вручную"),
});

export const restoreSchema = z.object({
  versionId: z.string().uuid(),
});

export const assetSchema = z.object({
  note: z.string().trim().max(500).optional().default(""),
  versionId: z.string().uuid().optional(),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Дайте заметке название.").max(180),
  text: z.string().trim().min(1, "Вставьте текст.").max(200_000),
});

export const feedbackSchema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string().trim().max(500).optional().default(""),
});

export const accountPatchSchema = z.object({
  locale: z.enum(["ru", "uz", "en"]),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
});

export const adminSettingsSchema = z.object({
  textDaily: z.number().int().min(1).max(1000),
  imageDaily: z.number().int().min(0).max(200),
  uploadDaily: z.number().int().min(0).max(200),
  embedDaily: z.number().int().min(0).max(5000),
  ratePerMinute: z.number().int().min(1).max(60),
});

export const userStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "disabled"]),
});

const contentResultSchema = z.object({
  title: z.string().trim().min(1).max(300),
  hook: z.string().trim().max(1000).optional().default(""),
  body: z.string().trim().min(1).max(20000),
  cta: z.string().trim().max(500).optional().default(""),
  hashtags: z.array(z.string().trim().max(80)).max(30).optional().default([]),
  visualPrompt: z.string().trim().max(2000).optional().default(""),
  notesToVerify: z.array(z.string().trim().max(500)).max(20).optional().default([]),
  language: z.string().trim().max(12).optional().default("ru"),
  format: z.string().trim().max(40).optional().default(""),
  variantLabel: z.string().trim().max(120).optional().default("Основной вариант"),
});

export const variantsSchema = z.object({
  variants: z.array(contentResultSchema).min(2).max(3),
});

const fieldLabels: Record<string, string> = {
  valueProposition: "Чем вы полезны",
  audience: "Аудитория",
  niche: "Ниша",
  tone: "Тон",
  name: "Название",
  topic: "Тема",
  products: "Продукт",
  forbiddenTerms: "Запрещённая формулировка",
  ctaDefaults: "Призыв",
};

export function zodError(error: z.ZodError) {
  const issue = error.issues[0];
  const field = fieldLabels[String(issue?.path[0] ?? "")] || "Поле";
  const tooLong = issue?.code === "too_big" && "maximum" in issue ? Number(issue.maximum) : 0;
  const message = tooLong
    ? `${field}: не больше ${tooLong} символов.`
    : issue?.message || "Проверьте поля формы.";
  return new AppError(message, 400, "VALIDATION");
}

export function parseInput<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw zodError(parsed.error);
  return parsed.data;
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new AppError("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new AppError("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
  }
}

export function parseContentResult(
  value: unknown,
  expected: { language: string; format: string; fallbackTitle: string },
): ContentResult {
  const source = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
  delete source.usedSources;
  delete source.used_sources;
  if (typeof source.title !== "string" || !source.title.trim()) source.title = expected.fallbackTitle.slice(0, 300);
  const parsed = contentResultSchema.safeParse(source);
  if (!parsed.success) {
    throw new AppError("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
  }
  const language = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(parsed.data.language) ? parsed.data.language : expected.language;
  return {
    ...parsed.data,
    hashtags: parsed.data.hashtags.map((tag) => tag.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean),
    language,
    format: expected.format,
  };
}
