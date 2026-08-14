/**
 * OpenAPI 3.1 document built from registered Hono routes (P12.2).
 * No request/response bodies with PII schemas inlined as secrets.
 */
import type { Hono } from "hono";

type PathItem = Record<string, Record<string, unknown>>;

const TAG_BY_PREFIX: Array<{ prefix: string; tag: string }> = [
  { prefix: "/health", tag: "Health" },
  { prefix: "/api/v1/auth", tag: "Auth" },
  { prefix: "/api/v1/profile", tag: "Profile" },
  { prefix: "/api/v1/sources", tag: "Sources" },
  { prefix: "/api/v1/jobs", tag: "Jobs" },
  { prefix: "/api/v1/applications", tag: "Applications" },
  { prefix: "/api/v1/emails", tag: "Emails" },
  { prefix: "/api/v1/notifications", tag: "Notifications" },
  { prefix: "/api/v1/analytics", tag: "Analytics" },
  { prefix: "/api/v1/team", tag: "Team" },
  { prefix: "/api/v1/automation", tag: "Automation" },
  { prefix: "/api/v1/realtime", tag: "Realtime" },
];

function tagFor(path: string): string {
  for (const { prefix, tag } of TAG_BY_PREFIX) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return tag;
  }
  return "API";
}

function needsBearer(path: string): boolean {
  if (path === "/health" || path.startsWith("/health/")) return false;
  if (path === "/api/v1/openapi.json") return false;
  if (path.startsWith("/api/v1/auth/")) {
    if (path.includes("/me") || path.includes("/logout")) return true;
    return false;
  }
  return path.startsWith("/api/v1/");
}

/** Build OpenAPI paths object from `app.routes` after modules register. */
export function buildOpenApiDocument(app: Hono): Record<string, unknown> {
  const paths: Record<string, PathItem> = {};

  for (const route of app.routes) {
    const method = String(route.method ?? "").toLowerCase();
    const path = String(route.path ?? "");
    if (!method || !path) continue;
    if (method === "all") continue;
    // Skip middleware-only entries without a handler name when path is wildcard
    if (path === "/*") continue;

    if (!paths[path]) paths[path] = {};
    if (paths[path][method]) continue;

    const op: Record<string, unknown> = {
      tags: [tagFor(path)],
      summary: `${method.toUpperCase()} ${path}`,
      responses: {
        "200": { description: "Success" },
        "401": { description: "Unauthorized" },
        "429": { description: "Rate limited" },
      },
    };
    if (needsBearer(path)) {
      op.security = [{ bearerAuth: [] }];
    }
    paths[path][method] = op;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "JobAutomater API",
      version: "0.1.0",
      description:
        "Auto-generated from registered Hono routes. Auth: Bearer JWT. Rate limits: 100/min authenticated, 20/min anonymous.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths,
  };
}
