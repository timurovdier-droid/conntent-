import { blobConfigured, geminiConfigured } from "@/lib/config";
import { databaseUrl, readyDb } from "@/lib/db/client";
import { json } from "@/lib/http";

export const runtime = "nodejs";

function databaseMode() {
  const url = databaseUrl();
  if (url.startsWith("libsql:")) return "turso";
  if (url.startsWith("file:")) return "local";
  return "unknown";
}

export async function GET() {
  try {
    let db = false;
    let migrated = false;
    let dbError: string | null = null;
    try {
      const client = await readyDb();
      await client.execute("SELECT 1");
      db = true;
      const row = await client.execute("SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1");
      migrated = row.rows.length > 0;
    } catch (error) {
      db = false;
      dbError = error instanceof Error ? error.message : "database_unavailable";
    }
    const mode = databaseMode();
    const onVercel = Boolean(process.env.VERCEL);
    const authSecret = process.env.AUTH_SECRET?.trim() ?? "";
    return json({
      ok: db && migrated && (mode !== "local" || !onVercel) && authSecret.length >= 16 && geminiConfigured(),
      db,
      migrated,
      databaseMode: mode,
      tursoTokenConfigured: Boolean(process.env.TURSO_AUTH_TOKEN?.trim()),
      onVercel,
      authSecretConfigured: authSecret.length >= 16,
      aiConfigured: geminiConfigured(),
      blobConfigured: blobConfigured(),
      dbError,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "health_check_failed",
        time: new Date().toISOString(),
      },
      500,
    );
  }
}
