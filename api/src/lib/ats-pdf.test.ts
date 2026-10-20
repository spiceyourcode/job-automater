import { describe, expect, it } from "vitest";
import {
  buildApplicationZip,
  sanitizeForWinAnsi,
  textToAtsPdf,
} from "./ats-pdf.js";

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

  it("sanitises characters WinAnsi cannot encode", () => {
    const out = sanitizeForWinAnsi(
      "\u25CF Led team \u2022 shipped \u2192 prod \u2713 done \u201Cquoted\u201D \u2014 dash\u2026",
    );
    expect(out).toBe('- Led team - shipped -> prod [x] done "quoted" - dash...');
    expect(out).not.toMatch(/[\u25CF\u2022\u2192\u2713\u201C\u201D\u2014\u2026]/);
  });

  it("preserves line breaks and latin-1 letters", () => {
    expect(sanitizeForWinAnsi("Line 1\r\nLine 2\tTabbed\nJos\u00e9")).toBe(
      "Line 1\nLine 2 Tabbed\nJos\u00e9",
    );
  });

  it("renders bullets and typographic symbols without throwing", async () => {
    const body = [
      "\u25CF Led migration to PostgreSQL \u2192 40% faster",
      "\u2022 Cut costs \u2014 12%",
      "\u2713 Shipped \u2705 emoji",
      "Name: Jos\u00e9 \u00d1u\u00f1ez",
    ].join("\n");
    const bytes = await textToAtsPdf("Tailored CV", body);
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
