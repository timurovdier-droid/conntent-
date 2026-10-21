import { blobConfigured, geminiConfigured } from "@/lib/config";
import { json } from "@/lib/http";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  let db = false;
  try {
    await getDb().execute("SELECT 1");
    db = true;
  } catch {
    db = false;
  }
  return json({
    ok: db,
    db,
    aiConfigured: geminiConfigured(),
    blobConfigured: blobConfigured(),
    time: new Date().toISOString(),
  });
}
