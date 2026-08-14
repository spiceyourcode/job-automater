import { describe, expect, it } from "vitest";
import { siteKeyFromUrl, SUBMIT_LIMITS } from "./submit-limits.js";

describe("siteKeyFromUrl", () => {
  it("maps known ATS/portals to short keys", () => {
    expect(siteKeyFromUrl("https://www.linkedin.com/jobs/view/1")).toBe(
      "linkedin",
    );
    expect(siteKeyFromUrl("https://www.indeed.com/viewjob?jk=1")).toBe(
      "indeed",
    );
    expect(siteKeyFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe(
      "greenhouse",
    );
    expect(siteKeyFromUrl("https://jobs.lever.co/acme/x")).toBe("lever");
    expect(
      siteKeyFromUrl("https://acme.wd5.myworkdayjobs.com/Careers/job/x"),
    ).toBe("workday");
    expect(siteKeyFromUrl("https://jobs.ashbyhq.com/acme/x")).toBe("ashby");
  });

  it("falls back to host or unknown", () => {
    expect(siteKeyFromUrl("https://careers.example.com/apply")).toBe(
      "careers.example.com",
    );
    expect(siteKeyFromUrl(null)).toBe("unknown");
  });
});

describe("SUBMIT_LIMITS", () => {
  it("defines finite per-site and daily caps", () => {
    expect(SUBMIT_LIMITS.perSitePerMinute).toBeGreaterThan(0);
    expect(SUBMIT_LIMITS.perSitePerDay).toBeGreaterThan(0);
    expect(SUBMIT_LIMITS.globalPerDay).toBeGreaterThan(0);
  });
});
