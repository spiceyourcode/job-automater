import { describe, expect, it } from "vitest";
import { enqueueSubmitApplication } from "./queue.js";

describe("enqueueSubmitApplication (HG-4)", () => {
  it("rejects payloads without approved_at before touching Redis", async () => {
    await expect(
      enqueueSubmitApplication({
        application_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        user_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        approved_at: "",
      }),
    ).rejects.toThrow(/approved_at/);
  });
});
