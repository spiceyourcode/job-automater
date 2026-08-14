/**
 * Structured JSON logger — never emit PII / CV / email body (HG-8).
 */
const BLOCKED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "email",
  "body",
  "bodytext",
  "body_text",
  "snippet",
  "tailoredcv",
  "tailored_cv",
  "tailoredcvcontent",
  "coverletter",
  "cover_letter",
  "coverlettercontent",
  "cv",
  "rawhtml",
  "raw_html",
  "apikey",
  "api_key",
  "secret",
]);

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function scrubForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 200) return `${value.slice(0, 40)}…[len=${value.length}]`;
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => scrubForLog(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(normalizeKey(k))) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = scrubForLog(v, depth + 1);
  }
  return out;
}

export type LogFields = Record<string, unknown>;

function emit(
  level: "info" | "warn" | "error",
  event: string,
  fields?: LogFields,
): void {
  const line = JSON.stringify(
    scrubForLog({
      ts: new Date().toISOString(),
      level,
      event,
      ...(fields ?? {}),
    }),
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
