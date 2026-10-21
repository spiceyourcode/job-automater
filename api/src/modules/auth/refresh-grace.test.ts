import { describe, expect, it } from "vitest";
import {
  REFRESH_REPLAY_GRACE_MS,
  canReuseRevokedSession,
} from "./refresh-grace.js";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const future = new Date(NOW.getTime() + 7 * 86_400_000);

const session = (revokedAt: Date | null, expiresAt = future) => ({
  revokedAt,
  expiresAt,
});

describe("canReuseRevokedSession", () => {
  it("accepts a rotation-revoked session inside the grace window", () => {
    expect(
      canReuseRevokedSession(session(new Date(NOW.getTime() - 1_000)), NOW),
    ).toBe(true);
  });

  it("accepts a session revoked exactly at the grace boundary", () => {
    expect(
      canReuseRevokedSession(
        session(new Date(NOW.getTime() - REFRESH_REPLAY_GRACE_MS)),
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects a session revoked beyond the grace window", () => {
    expect(
      canReuseRevokedSession(
        session(new Date(NOW.getTime() - REFRESH_REPLAY_GRACE_MS - 1)),
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects a session that was never revoked", () => {
    expect(canReuseRevokedSession(session(null), NOW)).toBe(false);
  });

  it("rejects an intentionally revoked session whose expiry was set to now", () => {
    expect(
      canReuseRevokedSession(
        session(new Date(NOW.getTime() - 1_000), NOW),
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects a session with a future revocation timestamp", () => {
    expect(
      canReuseRevokedSession(
        session(new Date(NOW.getTime() + 1_000)),
        NOW,
      ),
    ).toBe(false);
  });
});
