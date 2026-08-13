import { describe, expect, it } from "vitest";
import { createOAuthState, pkcePair } from "../../lib/oauth.js";
import { env } from "../../env.js";

describe("oauth helpers (P7.2)", () => {
  it("createOAuthState returns opaque hex", () => {
    const a = createOAuthState();
    const b = createOAuthState();
    expect(a).toMatch(/^[a-f0-9]{48}$/);
    expect(a).not.toBe(b);
  });

  it("pkcePair challenge is not the verifier", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier.length).toBeGreaterThan(20);
    expect(challenge).not.toBe(verifier);
  });

  it("API public URL is used for callbacks (not web APP_URL alone)", () => {
    expect(env.apiPublicUrl).toMatch(/^https?:\/\//);
    expect(env.apiPublicUrl).not.toContain("/oauth/complete");
  });
});
