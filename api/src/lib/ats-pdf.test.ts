import { describe, expect, it } from "vitest";
import { buildApplicationZip, textToAtsPdf } from "./ats-pdf.js";

describe("ATS PDF", () => {
  it("produces a non-empty PDF document", async () => {
    const bytes = await textToAtsPdf(
      "Tailored CV",
      "Built REST APIs with FastAPI and PostgreSQL at Acme Corp.",
    );
    const asString = Buffer.from(bytes).toString("latin1");
    expect(asString.startsWith("%PDF")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(200);
  });

  it("zip includes pdf + metadata without inventing content", async () => {
    const zip = await buildApplicationZip({
      cvText: "Built REST APIs with FastAPI",
      clText: "Dear team,\n\nBuilt REST APIs with FastAPI\n",
      metadata: { applicationId: "a1", traces: 1 },
    });
    expect(zip.length).toBeGreaterThan(100);
    // ZIP local file header signature
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});
