function trim(value: string | undefined) {
  return value?.trim() || "";
}

function looksLikeTursoUrl(value: string) {
  return value.startsWith("libsql:") || (value.startsWith("https://") && value.includes("turso"));
}

function scanEnv(match: (key: string, value: string) => boolean) {
  for (const [key, raw] of Object.entries(process.env)) {
    const value = trim(raw);
    if (!value) continue;
    if (match(key, value)) return value;
  }
  return null;
}

export function resolveTursoEnv() {
  const url =
    trim(process.env.TURSO_DATABASE_URL) ||
    trim(process.env.LIBSQL_URL) ||
    scanEnv((key, value) => /TURSO_.*URL/i.test(key) && looksLikeTursoUrl(value)) ||
    scanEnv((key, value) => /LIBSQL_.*URL/i.test(key) && looksLikeTursoUrl(value));

  const token =
    trim(process.env.TURSO_AUTH_TOKEN) ||
    trim(process.env.LIBSQL_AUTH_TOKEN) ||
    scanEnv((key, value) => /TURSO_.*TOKEN/i.test(key) && value.length >= 8) ||
    scanEnv((key, value) => /LIBSQL_.*TOKEN/i.test(key) && value.length >= 8);

  return { url: url || null, token: token || null };
}

export function tursoEnvStatus() {
  const { url, token } = resolveTursoEnv();
  return {
    urlConfigured: Boolean(url),
    tokenConfigured: Boolean(token),
    mode: url ? (url.startsWith("file:") ? "local" : "turso") : "unset",
  };
}
