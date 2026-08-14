import { describe, expect, it } from "vitest";
import { signAccessToken } from "./jwt.js";
import {
  fanoutLocal,
  handleClientMessage,
  isAllowedSubscribe,
  registerSocket,
  resetRealtimeForTests,
  resolveWsUserId,
  wsChannel,
} from "./realtime.js";

describe("wsChannel", () => {
  it("is unique per user (P11.5 FAILURE isolation)", () => {
    expect(wsChannel("user-a")).toBe("jobautomater:ws:user-a");
    expect(wsChannel("user-a")).not.toBe(wsChannel("user-b"));
  });
});

describe("isAllowedSubscribe", () => {
  it("allows own generic channels", () => {
    expect(isAllowedSubscribe("user-a", "notifications")).toBe(true);
    expect(isAllowedSubscribe("user-a", "applications")).toBe(true);
    expect(isAllowedSubscribe("user-a", "pipeline_run:123")).toBe(true);
    expect(isAllowedSubscribe("user-a", "user:user-a:notifications")).toBe(true);
  });

  it("rejects another user's channel", () => {
    expect(isAllowedSubscribe("user-a", "user:user-b:notifications")).toBe(
      false,
    );
    expect(isAllowedSubscribe("user-a", "jobautomater:ws:user-b")).toBe(false);
  });
});

describe("handleClientMessage", () => {
  it("returns FORBIDDEN when subscribing to another user", () => {
    const sent: string[] = [];
    handleClientMessage(
      "user-a",
      JSON.stringify({
        type: "subscribe",
        channels: ["user:user-b:notifications"],
      }),
      (d) => sent.push(d),
    );
    expect(sent[0]).toContain("FORBIDDEN");
  });
});

describe("fanoutLocal", () => {
  it("does not send user-b events to user-a sockets", () => {
    resetRealtimeForTests();
    const receivedA: string[] = [];
    const receivedB: string[] = [];
    registerSocket("user-a", {
      readyState: 1,
      send: (d) => receivedA.push(d),
      close: () => {},
    });
    registerSocket("user-b", {
      readyState: 1,
      send: (d) => receivedB.push(d),
      close: () => {},
    });
    fanoutLocal(
      "user-a",
      JSON.stringify({ type: "notification", title: "only-a" }),
    );
    expect(receivedA.join()).toContain("only-a");
    expect(receivedB.join()).not.toContain("only-a");
  });
});

describe("resolveWsUserId", () => {
  it("returns null without token or ticket", async () => {
    expect(await resolveWsUserId(new URL("http://localhost/api/v1/ws"))).toBe(
      null,
    );
  });

  it("resolves JWT token query to that user only", async () => {
    const token = await signAccessToken({
      sub: "user-a",
      email: "a@example.com",
      role: "owner",
      workspaceId: "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    const uid = await resolveWsUserId(
      new URL(`http://localhost/api/v1/ws?token=${token}`),
    );
    expect(uid).toBe("user-a");
    expect(uid).not.toBe("user-b");
  });
});
