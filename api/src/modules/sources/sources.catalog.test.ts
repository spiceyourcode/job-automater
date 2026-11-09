import { describe, expect, it } from "vitest";
import {
  loadJobSourceCatalog,
  listPublicCatalogEntries,
  validateCatalogEntryConfig,
} from "./sources.catalog.js";

describe("job-source-catalog.json", () => {
  it("loads and exposes public entries", () => {
    const catalog = loadJobSourceCatalog();
    expect(catalog.version).toBeGreaterThanOrEqual(1);
    expect(catalog.entries.length).toBeGreaterThanOrEqual(15);
    const pub = listPublicCatalogEntries();
    expect(pub.entries).toHaveLength(catalog.entries.length);
    for (const e of pub.entries) {
      expect(e).not.toHaveProperty("config");
    }
  });

  it("validates complete preset configs", () => {
    const catalog = loadJobSourceCatalog();
    for (const entry of catalog.entries) {
      if (entry.userFields?.length) continue;
      expect(() => validateCatalogEntryConfig(entry)).not.toThrow();
    }
  });

  it("includes africa and global regions", () => {
    const { entries } = listPublicCatalogEntries();
    const regions = new Set(entries.map((e) => e.region));
    expect(regions.has("global")).toBe(true);
    expect(regions.has("africa") || regions.has("kenya")).toBe(true);
  });
});
