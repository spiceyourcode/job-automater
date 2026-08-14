import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi.js";
import { createApp } from "../app.js";

describe("buildOpenApiDocument", () => {
  it("includes health and auth routes from the live app", () => {
    const app = createApp();
    const doc = buildOpenApiDocument(app) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/health"]).toBeTruthy();
    const pathKeys = Object.keys(doc.paths);
    expect(pathKeys.some((p) => p.includes("/api/v1/auth"))).toBe(true);
    expect(pathKeys.some((p) => p.includes("/api/v1/analytics"))).toBe(true);
  });

  it("works on a minimal router", () => {
    const app = new Hono();
    app.get("/health", (c) => c.json({ ok: true }));
    const doc = buildOpenApiDocument(app) as {
      paths: Record<string, { get?: unknown }>;
    };
    expect(doc.paths["/health"]?.get).toBeTruthy();
  });
});
