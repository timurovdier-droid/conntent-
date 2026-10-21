import { cookies } from "next/headers";
import { AppError, toErrorBody } from "@/lib/errors";
import { readSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/token";
import { findUserById } from "@/lib/db/repo";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown, requestId: string) {
  const mapped = toErrorBody(error, requestId);
  return json(mapped.body, mapped.status);
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("Не удалось прочитать данные запроса.", 400, "BAD_JSON");
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    throw new AppError("Запрос отклонён.", 403, "BAD_ORIGIN");
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("Запрос отклонён.", 403, "BAD_ORIGIN");
  }
  if (originHost !== host) {
    throw new AppError("Запрос отклонён.", 403, "BAD_ORIGIN");
  }
}

export function withHandler(
  fn: (request: Request, context: { params: Promise<Record<string, string>> }, requestId: string) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const requestId = crypto.randomUUID();
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        assertSameOrigin(request);
      }
      return await fn(request, context, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export async function sessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);
  if (!session) return null;
  const user = await findUserById(session.sub);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireUser() {
  const user = await sessionUser();
  if (!user) {
    throw new AppError("Войдите в аккаунт, чтобы продолжить.", 401, "UNAUTHORIZED");
  }
  return user;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 24 * 14));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key")?.trim().slice(0, 80) || "";
}
