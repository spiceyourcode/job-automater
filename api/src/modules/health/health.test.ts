import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "./index.js";

vi.mock("../../db/index.js", () => ({
  checkDatabaseConnection: vi.fn(),
}));

import { checkDatabaseConnection } from "../../db/index.js";

const mockedCheck = vi.mocked(checkDatabaseConnection);

const createApp = () => {
  const app = new Hono();
  registerRoutes(app);
  return app;
};

describe("GET /health", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when database is up", async () => {
    mockedCheck.mockResolvedValue(true);
    const app = createApp();
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      db: string;
      timestamp: string;
    };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("up");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns 503 when database is down", async () => {
    mockedCheck.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request("/health");

    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      db: string;
      timestamp: string;
    };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("down");
  });
});
