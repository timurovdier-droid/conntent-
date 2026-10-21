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
  let db = false;
  let migrated = false;
  try {
    const client = await readyDb();
    await client.execute("SELECT 1");
    db = true;
    const row = await client.execute("SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1");
    migrated = row.rows.length > 0;
  } catch {
    db = false;
  }
  const mode = databaseMode();
  const onVercel = Boolean(process.env.VERCEL);
  return json({
    ok: db && migrated && (mode !== "local" || !onVercel),
    db,
    migrated,
    databaseMode: mode,
    tursoTokenConfigured: Boolean(process.env.TURSO_AUTH_TOKEN?.trim()),
    onVercel,
    authSecretConfigured: Boolean(process.env.AUTH_SECRET?.trim() && process.env.AUTH_SECRET.trim().length >= 16),
    aiConfigured: geminiConfigured(),
    blobConfigured: blobConfigured(),
    time: new Date().toISOString(),
  });
}
