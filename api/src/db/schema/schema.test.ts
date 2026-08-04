import { describe, expect, it } from "vitest";
import {
  profileInsertSchema,
  salaryCentsSchema,
  userInsertSchema,
  userSessionInsertSchema,
} from "./validation.js";

const SAMPLE_USER_ID = "11111111-1111-4111-8111-111111111111";

describe("salaryCentsSchema (HG-3)", () => {
  it("accepts integer cents", () => {
    expect(salaryCentsSchema.parse(150000)).toBe(150000);
  });

  it("rejects floats", () => {
    expect(salaryCentsSchema.safeParse(15.5).success).toBe(false);
  });
});

describe("profileInsertSchema", () => {
  it("rejects float salary", () => {
    const result = profileInsertSchema.safeParse({
      userId: SAMPLE_USER_ID,
      salaryMin: 120000.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts integer salary cents", () => {
    const result = profileInsertSchema.safeParse({
      userId: SAMPLE_USER_ID,
      salaryMin: 12000000,
      salaryMax: 18000000,
    });
    expect(result.success).toBe(true);
  });
});

describe("userInsertSchema", () => {
  it("requires email", () => {
    expect(userInsertSchema.safeParse({}).success).toBe(false);
    expect(
      userInsertSchema.safeParse({ email: "user@example.com" }).success,
    ).toBe(true);
  });
});

describe("userSessionInsertSchema", () => {
  it("requires token hash and expiry", () => {
    expect(
      userSessionInsertSchema.safeParse({
        userId: SAMPLE_USER_ID,
        tokenHash: "abc",
        expiresAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});
