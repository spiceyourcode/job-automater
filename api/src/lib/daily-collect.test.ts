import { describe, expect, it } from "vitest";
import { DAILY_COLLECT_CRON, scheduleKey } from "./daily-collect.js";

describe("daily collect schedule helpers", () => {
  it("uses AppFlow 06:00 cron pattern", () => {
    expect(DAILY_COLLECT_CRON).toBe("0 6 * * *");
  });

  it("scopes repeatable job ids per user", () => {
    expect(scheduleKey("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(
      "daily-user-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
  });
});
