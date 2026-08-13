import { describe, expect, it, vi, beforeEach } from "vitest";
import { hashToken } from "../../lib/token.js";

vi.mock("../../lib/mailer.js", () => ({
  sendMail: vi.fn(async () => undefined),
  verificationEmail: vi.fn(({ to, verifyUrl }: { to: string; verifyUrl: string }) => ({
    to,
    subject: "Verify",
    text: verifyUrl,
  })),
  passwordResetEmail: vi.fn(({ to, resetUrl }: { to: string; resetUrl: string }) => ({
    to,
    subject: "Reset",
    text: resetUrl,
  })),
}));

// Lightweight unit tests for token hashing behavior used by reset/verify
describe("auth token hashing (P7.1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashToken is deterministic and not reversible plaintext", () => {
    const a = hashToken("raw-token-value-abcdefghijklmnopqrst");
    const b = hashToken("raw-token-value-abcdefghijklmnopqrst");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toContain("raw-token");
  });

  it("different tokens produce different hashes", () => {
    expect(hashToken("token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa")).not.toBe(
      hashToken("token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    );
  });
});
