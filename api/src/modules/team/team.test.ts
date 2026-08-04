import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { teamRoutes } from "./team.routes.js";

vi.mock("./team.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./team.service.js")>();
  return {
    ...actual,
    getWorkspace: vi.fn(),
    listMembers: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    TeamError: actual.TeamError,
  };
});

import * as teamService from "./team.service.js";
const mockService = vi.mocked(teamService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/team", teamRoutes);
  return app;
};

describe("POST /api/v1/team/members", () => {
  afterEach(() => vi.clearAllMocks());

  it("403 for member role", async () => {
    const res = await buildApp().request("/api/v1/team/members", {
      method: "POST",
      headers: {
        Authorization: await testAuthHeader("user-a", "member"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "b@example.com", role: "viewer" }),
    });
    expect(res.status).toBe(403);
    expect(mockService.inviteMember).not.toHaveBeenCalled();
  });

  it("201 owner invites member", async () => {
    mockService.inviteMember.mockResolvedValue({
      member: {
        userId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        email: "b@example.com",
        role: "member",
      },
    });
    const res = await buildApp().request("/api/v1/team/members", {
      method: "POST",
      headers: {
        Authorization: await testAuthHeader("user-a", "owner"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "b@example.com", role: "member" }),
    });
    expect(res.status).toBe(201);
  });
});

describe("GET /api/v1/team/members", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 lists for viewer", async () => {
    mockService.listMembers.mockResolvedValue({
      members: [
        {
          userId: "a",
          role: "owner",
          email: "a@example.com",
          name: null,
          createdAt: new Date(),
        },
      ],
    });
    const res = await buildApp().request("/api/v1/team/members", {
      headers: { Authorization: await testAuthHeader("user-a", "viewer") },
    });
    expect(res.status).toBe(200);
  });
});
