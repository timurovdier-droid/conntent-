import { resolveTursoEnv, tursoEnvStatus } from "@/lib/db/turso-env";
import { AppError } from "@/lib/errors";

export { tursoEnvStatus };

export function databaseUrl() {
  const { url } = resolveTursoEnv();
  return url || "file:data/contentpilot.db";
}

export function databaseAuthToken() {
  return resolveTursoEnv().token || undefined;
}

export function assertRemoteDatabaseConfigured() {
  const { url, token } = resolveTursoEnv();
  if (process.env.VERCEL && !url) {
    throw new AppError(
      "На Vercel задайте TURSO_DATABASE_URL (libsql://…) и TURSO_AUTH_TOKEN в Settings → Environment Variables → Production, затем Redeploy.",
      503,
      "DB_MISCONFIGURED",
    );
  }
  if (url && !url.startsWith("file:") && !token) {
    throw new AppError(
      "Для облачной базы Turso нужен TURSO_AUTH_TOKEN. Добавьте его в Vercel и выполните Redeploy.",
      503,
      "DB_MISCONFIGURED",
    );
  }
}
