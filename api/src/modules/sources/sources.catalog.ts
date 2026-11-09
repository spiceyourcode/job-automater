import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  sourceConfigByType,
  sourceTypeSchema,
  type SourceType,
} from "./sources.schema.js";

const catalogRegionSchema = z.enum([
  "global",
  "africa",
  "kenya",
  "europe",
  "americas",
]);

const catalogEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(255),
    description: z.string().max(2000),
    region: catalogRegionSchema,
    tags: z.array(z.string().max(50)),
    sourceType: sourceTypeSchema,
    status: z.enum(["stable", "beta"]),
    config: z.record(z.string(), z.unknown()).default({}),
    userFields: z.array(z.string().max(50)).optional(),
  })
  .strict();

const catalogFileSchema = z
  .object({
    version: z.number().int().positive(),
    entries: z.array(catalogEntrySchema).min(1),
  })
  .strict();

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

export type PublicCatalogEntry = Omit<CatalogEntry, "config"> & {
  userFields?: string[];
};

let _catalog: z.infer<typeof catalogFileSchema> | null = null;

function catalogPath(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, "job-source-catalog.json");
}

export function loadJobSourceCatalog(): z.infer<typeof catalogFileSchema> {
  if (_catalog) return _catalog;
  const raw = JSON.parse(readFileSync(catalogPath(), "utf8")) as unknown;
  const parsed = catalogFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid job-source-catalog.json: ${parsed.error.issues[0]?.message}`,
    );
  }
  for (const entry of parsed.data.entries) {
    validateCatalogEntryConfig(entry);
  }
  const ids = parsed.data.entries.map((e) => e.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("job-source-catalog.json: duplicate entry ids");
  }
  _catalog = parsed.data;
  return _catalog;
}

/** Validate preset config (catalogId added at install time). */
export function validateCatalogEntryConfig(entry: CatalogEntry): void {
  const missingUser = entry.userFields ?? [];
  const configForType = { ...entry.config };
  for (const field of missingUser) {
    if (!(field in configForType) || configForType[field] === "") {
      // user must supply — skip strict validation here
      continue;
    }
  }
  const needsComplete =
    missingUser.length === 0 ||
    missingUser.every(
      (f) =>
        f in entry.config &&
        entry.config[f] !== undefined &&
        entry.config[f] !== "",
    );
  if (!needsComplete) {
    return;
  }
  const schema = sourceConfigByType[entry.sourceType as SourceType];
  const withCatalog = { ...configForType, catalogId: entry.id };
  const parsed = schema.safeParse(withCatalog);
  if (!parsed.success) {
    throw new Error(
      `Catalog entry ${entry.id}: ${parsed.error.issues[0]?.message ?? "invalid config"}`,
    );
  }
}

export function getCatalogEntryById(id: string): CatalogEntry | undefined {
  const catalog = loadJobSourceCatalog();
  return catalog.entries.find((e) => e.id === id);
}

export function listPublicCatalogEntries(): {
  version: number;
  entries: PublicCatalogEntry[];
} {
  const catalog = loadJobSourceCatalog();
  return {
    version: catalog.version,
    entries: catalog.entries.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      region: e.region,
      tags: e.tags,
      sourceType: e.sourceType,
      status: e.status,
      userFields: e.userFields,
    })),
  };
}

export function buildCreateBodyFromCatalog(
  entry: CatalogEntry,
  overrides?: Record<string, unknown>,
): {
  sourceType: SourceType;
  name: string;
  description: string;
  config: Record<string, unknown>;
} {
  const userFields = entry.userFields ?? [];
  const config = { ...entry.config, catalogId: entry.id };
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== "") config[k] = v;
    }
  }
  for (const field of userFields) {
    if (
      config[field] === undefined ||
      config[field] === "" ||
      config[field] === null
    ) {
      throw new SourceCatalogNeedsInputError(entry.id, userFields);
    }
  }
  return {
    sourceType: entry.sourceType,
    name: entry.name,
    description: entry.description,
    config,
  };
}

export class SourceCatalogNeedsInputError extends Error {
  constructor(
    readonly catalogId: string,
    readonly fields: string[],
  ) {
    super(`Catalog entry ${catalogId} requires user input`);
    this.name = "SourceCatalogNeedsInputError";
  }
}
