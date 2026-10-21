import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db/client";

export async function migrate() {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const existing = await db.execute({
      sql: "SELECT id FROM schema_migrations WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length > 0) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    if (typeof db.executeMultiple === "function") {
      await db.executeMultiple(sql);
    } else {
      for (const statement of sql.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean)) {
        await db.execute(statement);
      }
    }
    await db.execute({
      sql: "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      args: [id, new Date().toISOString()],
    });
  }
}
