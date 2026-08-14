import { describe, expect, it } from "vitest";
import { assertOwnerOnly, csvCell, toCsv } from "./csv.js";

describe("assertOwnerOnly", () => {
  it("allows rows that belong to the owner", () => {
    const rows = assertOwnerOnly("user-a", [
      { userId: "user-a", title: "Eng" },
    ]);
    expect(rows).toHaveLength(1);
  });

  it("rejects another user's rows (P11.4 FAILURE)", () => {
    expect(() =>
      assertOwnerOnly("user-a", [{ userId: "user-b", title: "Secret" }]),
    ).toThrow("export_owner_mismatch");
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    expect(csvCell('Acme, "Inc"')).toBe('"Acme, ""Inc"""');
    const csv = toCsv(["company", "count"], [["Acme", 2]]);
    expect(csv).toContain("company,count");
    expect(csv).not.toContain("user-b");
  });
});
