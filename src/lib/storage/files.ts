import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { blobConfigured } from "@/lib/config";

const root = path.join(process.cwd(), "storage");

export function storageMode(): "blob" | "local" | "none" {
  if (blobConfigured()) return "blob";
  if (process.env.VERCEL) return "none";
  return "local";
}

function localPath(key: string) {
  const relative = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (relative.includes("..")) return null;
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root))) return null;
  return full;
}

export async function writePrivate(key: string, bytes: Uint8Array, mime: string) {
  const mode = storageMode();
  if (mode === "none") return null;
  if (mode === "local") {
    const full = localPath(key);
    if (!full) return null;
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return `local:${key}`;
  }
  const { put } = await import("@vercel/blob");
  const created = await put(key, Buffer.from(bytes), {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: mime,
    addRandomSuffix: false,
  });
  return `blob:${created.pathname}`;
}

export async function readPrivate(storageKey: string) {
  if (storageKey.startsWith("local:")) {
    const full = localPath(storageKey.slice("local:".length));
    if (!full) return null;
    try {
      return new Uint8Array(await readFile(full));
    } catch {
      return null;
    }
  }
  if (storageKey.startsWith("blob:")) {
    const { get } = await import("@vercel/blob");
    const result = await get(storageKey.slice("blob:".length), {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const buffer = await new Response(result.stream).arrayBuffer();
    return new Uint8Array(buffer);
  }
  return null;
}

export async function deletePrivate(storageKey: string | null | undefined) {
  if (!storageKey) return;
  if (storageKey.startsWith("local:")) {
    const full = localPath(storageKey.slice("local:".length));
    if (full) await rm(full, { force: true });
    return;
  }
  if (storageKey.startsWith("blob:")) {
    const { del } = await import("@vercel/blob");
    await del(storageKey.slice("blob:".length), { token: process.env.BLOB_READ_WRITE_TOKEN });
  }
}
