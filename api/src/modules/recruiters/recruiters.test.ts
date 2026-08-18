import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { recruitersRoutes } from "./recruiters.routes.js";

vi.mock("./recruiters.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./recruiters.service.js")>();
  return {
    ...actual,
    listContacts: vi.fn(),
    createContact: vi.fn(),
    getContact: vi.fn(),
    RecruiterError: actual.RecruiterError,
  };
});

import * as recruitersService from "./recruiters.service.js";
const mockService = vi.mocked(recruitersService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/recruiters", recruitersRoutes);
  return app;
};

describe("GET /api/v1/recruiters", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/recruiters");
    expect(res.status).toBe(401);
  });

  it("200 lists caller contacts", async () => {
    mockService.listContacts.mockResolvedValue({ contacts: [] });
    const res = await buildApp().request("/api/v1/recruiters", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.listContacts).toHaveBeenCalledWith("user-a", undefined);
  });
});

describe("POST /api/v1/recruiters", () => {
  afterEach(() => vi.clearAllMocks());

  it("201 creates a referral contact", async () => {
    mockService.createContact.mockResolvedValue({
      contact: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Ada",
        company: "Acme",
        email: null,
        role: null,
        linkedinUrl: null,
        notes: null,
        kind: "referral",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const res = await buildApp().request("/api/v1/recruiters", {
      method: "POST",
      headers: {
        Authorization: await testAuthHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Ada", kind: "referral" }),
    });
    expect(res.status).toBe(201);
    expect(mockService.createContact).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ name: "Ada", kind: "referral" }),
    );
  });
});

describe("GET /api/v1/recruiters/:id", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 IDOR", async () => {
    mockService.getContact.mockRejectedValue(
      new recruitersService.RecruiterError("Contact not found", 404),
    );
    const res = await buildApp().request(
      "/api/v1/recruiters/11111111-1111-4111-8111-111111111111",
      { headers: { Authorization: await testAuthHeader("user-b") } },
    );
    expect(res.status).toBe(404);
  });
});
