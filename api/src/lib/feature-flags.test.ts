import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "./feature-flags.js";

describe("getFeatureFlags", () => {
  it("keeps auto-apply off by default (HG-4)", () => {
    const prev = process.env.FEATURE_AUTO_APPLY;
    delete process.env.FEATURE_AUTO_APPLY;
    const flags = getFeatureFlags();
    expect(flags.autoApplyWithoutApproval).toBe(false);
    if (prev !== undefined) process.env.FEATURE_AUTO_APPLY = prev;
  });

  it("never returns secret strings", () => {
    const flags = getFeatureFlags();
    const json = JSON.stringify(flags);
    expect(json).not.toMatch(/sk-|Bearer|password/i);
    for (const v of Object.values(flags)) {
      expect(typeof v).toBe("boolean");
    }
  });
});
