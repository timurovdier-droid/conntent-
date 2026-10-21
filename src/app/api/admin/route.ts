import { AppError } from "@/lib/errors";
import { config, geminiConfigured } from "@/lib/config";
import { json, readJson, requireUser, withHandler } from "@/lib/http";
import { adminSettingsSchema, parseInput, userStatusSchema } from "@/lib/ai/schemas";
import { insertAudit, listUsers, recentFailures, setSetting, updateUser, usageSummary } from "@/lib/db/repo";
import { currentLimits } from "@/lib/services/quota";

export const runtime = "nodejs";

async function admin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new AppError("Раздел недоступен.", 404, "NOT_FOUND");
  return user;
}

export const GET = withHandler(async () => {
  await admin();
  const [users, failures, usage, limits] = await Promise.all([
    listUsers(),
    recentFailures(),
    usageSummary(),
    currentLimits(),
  ]);
  return json({
    users,
    failures,
    usage,
    limits,
    aiConfigured: geminiConfigured(),
    models: {
      text: config.textModel,
      image: config.imageModel,
      embedding: config.embeddingModel,
    },
  });
});

export const PATCH = withHandler(async (request) => {
  const user = await admin();
  const raw = await readJson(request);
  if (raw && typeof raw === "object" && "userId" in raw) {
    const body = parseInput(userStatusSchema, raw);
    if (body.userId === user.id && body.status === "disabled") {
      throw new AppError("Нельзя отключить собственный аккаунт администратора.", 400, "VALIDATION");
    }
    await updateUser(body.userId, { status: body.status });
    await insertAudit(user.id, "set_user_status", "user", body.userId, { status: body.status });
    return json({ ok: true });
  }
  const body = parseInput(adminSettingsSchema, raw);
  await setSetting("text_daily", body.textDaily);
  await setSetting("image_daily", body.imageDaily);
  await setSetting("upload_daily", body.uploadDaily);
  await setSetting("embed_daily", body.embedDaily);
  await setSetting("rate_per_minute", body.ratePerMinute);
  await insertAudit(user.id, "update_quotas", "settings", "quotas");
  return json({ ok: true });
});
