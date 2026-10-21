import { AppError } from "@/lib/errors";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

export function geminiErrorFromPayload(payload: unknown) {
  const err = asRecord(asRecord(payload)?.error);
  if (!err) return null;
  const message = typeof err.message === "string" ? err.message : "";
  const code = typeof err.code === "string" ? err.code : "";
  return { message, code };
}

function looksLikeSafety(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("prohibited") ||
    lower.includes("policy") ||
    lower.includes("harm") ||
    lower.includes("refus")
  );
}

function publicDetail(message: string, max = 220) {
  const trimmed = message.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function interactionFailureMessage(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return null;
  const top = asRecord(record.error);
  if (typeof top?.message === "string" && top.message) return top.message;
  if (typeof record.error_message === "string" && record.error_message) return record.error_message;
  if (typeof record.message === "string" && record.message) return record.message;
  if (Array.isArray(record.steps)) {
    for (const step of record.steps) {
      const block = asRecord(step);
      if (!block) continue;
      if (block.type === "error" && typeof block.message === "string") return block.message;
      const err = asRecord(block.error);
      if (typeof err?.message === "string") return err.message;
    }
  }
  return null;
}

export function mapGeminiHttpError(httpStatus: number, payload: unknown): AppError {
  const { message, code } = geminiErrorFromPayload(payload) ?? { message: "", code: "" };
  const detail = publicDetail(message);

  if (httpStatus === 401 || httpStatus === 403) {
    return new AppError("Сервер не смог авторизоваться в модели. Проверьте ключ GEMINI_API_KEY.", 502, "AI_AUTH");
  }

  if (httpStatus === 429 || code === "too_many_requests") {
    if (/limit:\s*0/i.test(message) || /free tier/i.test(message)) {
      return new AppError(
        "Для этой модели исчерпан дневной лимит на вашем тарифе Google AI. Попробуйте позже или подключите платный тариф.",
        429,
        "AI_QUOTA",
        true,
      );
    }
    return new AppError("Слишком много запросов к модели. Подождите минуту и попробуйте снова.", 429, "AI_RATE_LIMIT", true);
  }

  if (httpStatus === 503 || code === "service_unavailable" || /high demand/i.test(message)) {
    return new AppError("Модель перегружена. Подождите минуту и нажмите «Повторить».", 503, "AI_OVERLOAD", true);
  }

  if (httpStatus >= 500) {
    return new AppError("Сервис модели временно недоступен. Попробуйте ещё раз позже.", 502, "AI_PROVIDER_UNAVAILABLE", true);
  }

  if (code === "invalid_request") {
    return new AppError(
      detail
        ? `Запрос к модели не принят: ${detail}`
        : "Запрос к модели не принят. Обновите страницу и попробуйте снова.",
      502,
      "AI_BAD_REQUEST",
      true,
    );
  }

  if (looksLikeSafety(message)) {
    return new AppError("Модель отклонила запрос из‑за правил безопасности. Смягчите формулировку темы или правки.", 422, "AI_REFUSED");
  }

  if (detail) {
    return new AppError(detail, httpStatus >= 400 ? httpStatus : 502, "AI_ERROR", httpStatus === 408);
  }

  return new AppError("Не удалось получить ответ от модели. Попробуйте ещё раз.", 502, "AI_PROVIDER_UNAVAILABLE", true);
}

export function mapInteractionFailure(payload: unknown): AppError {
  const reason = interactionFailureMessage(payload) ?? "";
  if (looksLikeSafety(reason)) {
    return new AppError("Модель отклонила запрос из‑за правил безопасности. Смягчите формулировку темы или правки.", 422, "AI_REFUSED");
  }
  if (/high demand|service_unavailable|overloaded/i.test(reason)) {
    return new AppError("Модель перегружена. Подождите минуту и нажмите «Повторить».", 503, "AI_OVERLOAD", true);
  }
  if (reason) {
    return new AppError(publicDetail(reason), 502, "AI_INCOMPLETE", true);
  }
  return new AppError("Модель не завершила ответ. Попробуйте ещё раз.", 502, "AI_INCOMPLETE", true);
}
