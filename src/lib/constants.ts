export const CONTENT_TYPES = [
  { id: "social_post", label: "Пост для соцсетей", hint: "Хук, текст, призыв и хештеги" },
  { id: "ad_copy", label: "Рекламный текст", hint: "Короткое объявление с понятным действием" },
  { id: "product_description", label: "Описание товара или услуги", hint: "Факты, выгоды и то, что нужно проверить" },
  { id: "short_video_script", label: "Сценарий короткого видео", hint: "Хук, кадры и финальная фраза" },
  { id: "content_plan", label: "Идеи и план на неделю", hint: "Семь тем без обещания охватов" },
] as const;

export const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "telegram", label: "Telegram" },
  { id: "facebook", label: "Facebook" },
  { id: "website", label: "Сайт" },
  { id: "marketplace", label: "Маркетплейс" },
] as const;

export const GOALS = [
  { id: "awareness", label: "Узнаваемость" },
  { id: "leads", label: "Заявки" },
  { id: "sales", label: "Продажи" },
  { id: "engagement", label: "Ответы и обсуждение" },
  { id: "education", label: "Объяснить пользу" },
] as const;

export const LANGUAGES = [
  { id: "ru", label: "Русский" },
  { id: "uz", label: "Oʻzbekcha" },
  { id: "en", label: "English" },
] as const;

export type ContentTypeId = (typeof CONTENT_TYPES)[number]["id"];
export type PlatformId = (typeof PLATFORMS)[number]["id"];
export type GoalId = (typeof GOALS)[number]["id"];

export function labelOf(list: readonly { id: string; label: string }[], id: string) {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function aspectForPlatform(platform: string) {
  if (platform === "tiktok" || platform === "youtube_shorts") return "9:16";
  if (platform === "website") return "16:9";
  if (platform === "instagram") return "4:5";
  return "1:1";
}
