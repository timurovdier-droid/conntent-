import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { mapGeminiHttpError, mapInteractionFailure } from "@/lib/ai/gemini-errors";
import { interactionFailed, readEmbeddingValues, readInteractionImage, readInteractionText, readUsage } from "@/lib/ai/interaction";

function apiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AppError("Генерация не настроена. Добавьте GEMINI_API_KEY на сервере.", 503, "AI_NOT_CONFIGURED");
  }
  return key;
}

async function postGemini(url: string, body: unknown, timeoutMs: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError("Запрос отменён.", 400, "CANCELLED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      throw mapGeminiHttpError(response.status, payload);
    }
    if (interactionFailed(payload)) {
      throw mapInteractionFailure(payload);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal?.aborted) throw new AppError("Запрос отменён.", 400, "CANCELLED");
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Модель не ответила вовремя. Попробуйте ещё раз.", 504, "AI_TIMEOUT", true);
    }
    throw new AppError("Не удалось создать результат. Попробуйте ещё раз позже.", 502, "AI_PROVIDER_UNAVAILABLE", true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const RETRY_DELAYS_MS = [1200, 2800, 5500];

async function withRetries<T>(run: () => Promise<T>) {
  let last: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!(error instanceof AppError) || !error.retryable || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw last;
}

export async function generateText(system: string, user: string, signal?: AbortSignal) {
  const payload = await withRetries(() =>
    postGemini(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        model: config.textModel,
        input: `${system}\n\n${user}`,
      },
      config.textTimeoutMs,
      signal,
    ),
  );
  const text = readInteractionText(payload);
  if (!text) {
    throw new AppError("Модель вернула пустой ответ. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
  }
  return { text, modelId: config.textModel, usage: readUsage(payload) };
}

export async function generateImage(prompt: string, aspectRatio: string, signal?: AbortSignal) {
  const payload = await withRetries(() =>
    postGemini(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        model: config.imageModel,
        input: prompt,
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: aspectRatio,
          image_size: "1K",
        },
      },
      config.imageTimeoutMs,
      signal,
    ),
  );
  const image = readInteractionImage(payload);
  if (!image) {
    throw new AppError("Модель не вернула изображение. Попробуйте ещё раз.", 502, "AI_BAD_RESPONSE", true);
  }
  return { ...image, modelId: config.imageModel, usage: readUsage(payload) };
}

export async function embedText(text: string, signal?: AbortSignal) {
  const model = config.embeddingModel;
  const payload = await withRetries(() =>
    postGemini(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
      {
        model: `models/${model}`,
        content: { parts: [{ text: text.slice(0, 12_000) }] },
        embedContentConfig: { outputDimensionality: config.embeddingDimensions },
      },
      config.embedTimeoutMs,
      signal,
    ),
  );
  const values = readEmbeddingValues(payload);
  if (!values || values.length !== config.embeddingDimensions) {
    throw new AppError("Не удалось построить вектор для поиска.", 502, "EMBEDDING_FAILED", true);
  }
  return values;
}
