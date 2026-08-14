import { describe, expect, it } from "vitest";
import { scrubSentryEventForTest } from "./sentry.js";

describe("scrubSentryEventForTest", () => {
  it("strips request body and CV-like extras (P12.2 FAILURE)", () => {
    const scrubbed = scrubSentryEventForTest({
      request: {
        data: { body_text: "SECRET EMAIL" },
        headers: { authorization: "Bearer x" },
        cookies: { access_token: "x" },
      },
      user: { email: "a@b.com", id: "u1" },
      extra: { tailored_cv: "SECRET CV", path: "/x" },
      breadcrumbs: [
        {
          message: "body_text received",
          data: { cover_letter: "SECRET CL" },
        },
      ],
    } as never);

    expect(scrubbed?.request?.data).toBeUndefined();
    expect(scrubbed?.request?.headers).toBeUndefined();
    expect(scrubbed?.user?.email).toBeUndefined();
    expect((scrubbed?.extra as Record<string, unknown>).tailored_cv).toBe(
      "[redacted]",
    );
    expect(scrubbed?.breadcrumbs?.[0]?.message).toBe("[redacted]");
    expect(
      (scrubbed?.breadcrumbs?.[0]?.data as Record<string, unknown>)
        .cover_letter,
    ).toBe("[redacted]");
    expect(JSON.stringify(scrubbed)).not.toContain("SECRET");
  });
});
