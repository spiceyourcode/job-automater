import { describe, expect, it } from "vitest";
import { publicErrorFields, scrubForLog } from "./logger.js";

describe("scrubForLog", () => {
  it("redacts email body and CV fields (P12.2 FAILURE)", () => {
    const scrubbed = scrubForLog({
      event: "ok",
      body_text: "SECRET EMAIL BODY",
      tailored_cv: "SECRET CV TEXT",
      cover_letter: "SECRET CL",
      path: "/api/v1/jobs",
    }) as Record<string, unknown>;
    expect(scrubbed.body_text).toBe("[redacted]");
    expect(scrubbed.tailored_cv).toBe("[redacted]");
    expect(scrubbed.cover_letter).toBe("[redacted]");
    expect(scrubbed.path).toBe("/api/v1/jobs");
    expect(JSON.stringify(scrubbed)).not.toContain("SECRET");
  });

  it("prefers driver cause over Failed query wrapper", () => {
    const err = new Error("Failed query: select * from users\nparams: secret@example.com");
    err.cause = new Error('password authentication failed for user "jobautomater"');
    const fields = publicErrorFields(err);
    expect(fields.message).toBe('password authentication failed for user "jobautomater"');
    expect(JSON.stringify(fields)).not.toContain("secret@example.com");
  });

  it("redacts password and tokens", () => {
    const scrubbed = scrubForLog({
      password: "hunter2",
      accessToken: "jwt…",
      email: "user@example.com",
    }) as Record<string, unknown>;
    expect(scrubbed.password).toBe("[redacted]");
    expect(scrubbed.accessToken).toBe("[redacted]");
    expect(scrubbed.email).toBe("[redacted]");
  });
});
