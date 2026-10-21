import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = `smoke-${Date.now()}@contentpilot.local`;
const password = "smoke-test-12";

function pickCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const list = raw.length ? raw : [headers.get("set-cookie")].filter(Boolean);
  return list.map((c) => c.split(";")[0]).join("; ");
}

async function api(pathname, { method = "GET", json, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      origin: base,
      ...(json ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

console.log("base", base);

let { response: regRes, body: regBody } = await api("/api/auth/register", {
  method: "POST",
  json: { email, password, consent: true },
});
let cookie = pickCookie(regRes.headers);
if (!regRes.ok) {
  console.error("register failed", regRes.status, regBody);
  process.exit(1);
}

const { response: projRes, body: project } = await api("/api/projects", {
  method: "POST",
  json: {
    contentType: "social_post",
    platform: "instagram",
    goal: "leads",
    language: "ru",
    topic: "Анонс новой коллекции керамических кружек ручной работы",
    useKnowledgeBase: false,
  },
  cookie,
});
if (!projRes.ok) {
  console.error("project failed", projRes.status, project);
  process.exit(1);
}

const idempotencyKey = crypto.randomUUID();
const started = Date.now();
const { response: genRes, body: genBody } = await api("/api/content/generate", {
  method: "POST",
  json: {
    projectId: project.id,
    contentType: "social_post",
    platform: "instagram",
    goal: "leads",
    language: "ru",
    topic: "Анонс новой коллекции керамических кружек ручной работы",
    useKnowledgeBase: false,
  },
  cookie,
  headers: { "idempotency-key": idempotencyKey },
});
console.log("generate", genRes.status, `${Date.now() - started}ms`);
if (!genRes.ok) {
  console.error(JSON.stringify(genBody, null, 2));
  process.exit(1);
}
console.log("title", genBody.content?.title);
console.log("body preview", String(genBody.content?.body || "").slice(0, 160));
console.log("ok");
