import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";
import { assertRemoteDatabaseConfigured, databaseAuthToken, databaseUrl } from "@/lib/db/client-config";

export { databaseUrl, tursoEnvStatus } from "@/lib/db/client-config";

let client: Client | null = null;
let clientUrl: string | null = null;
let migrating: Promise<void> | null = null;
let foreignKeysOn = false;

export function getDb() {
  assertRemoteDatabaseConfigured();
  const url = databaseUrl();
  if (client && clientUrl === url) return client;
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    mkdirSync(path.dirname(absolute), { recursive: true });
  }
  client?.close();
  client = createClient({
    url,
    authToken: databaseAuthToken(),
  });
  clientUrl = url;
  foreignKeysOn = false;
  return client;
}

export function resetDbForTests() {
  client?.close();
  client = null;
  clientUrl = null;
  migrating = null;
  foreignKeysOn = false;
}

export async function readyDb() {
  if (!migrating) {
    migrating = import("./migrate")
      .then((mod) => mod.migrate())
      .catch((error) => {
        migrating = null;
        throw error;
      });
  }
  await migrating;
  const db = getDb();
  if (!foreignKeysOn) {
    await db.execute("PRAGMA foreign_keys = ON");
    foreignKeysOn = true;
  }
  return db;
}

export async function queryMany(sql: string, args: InValue[] = []) {
  const db = await readyDb();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as Record<string, unknown>[];
}

export async function queryOne(sql: string, args: InValue[] = []) {
  const rows = await queryMany(sql, args);
  return rows[0] ?? null;
}

export async function execute(sql: string, args: InValue[] = []) {
  const db = await readyDb();
  await db.execute({ sql, args });
}

export async function executeBatch(statements: { sql: string; args?: InValue[] }[]) {
  const db = await readyDb();
  if (statements.length === 0) return;
  await db.batch(
    statements.map((statement) => ({ sql: statement.sql, args: statement.args ?? [] })),
    "write",
  );
}
