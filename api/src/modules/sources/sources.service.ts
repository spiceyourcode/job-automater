import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sourceConfigs, type SourceConfig } from "../../db/schema/index.js";
import { enqueueCollectSource } from "../../lib/queue.js";
import {
  sourceConfigByType,
  type CreateSourceBody,
  type PatchSourceBody,
  type SourceType,
} from "./sources.schema.js";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

/** Strip secrets from config before returning to clients (HG-8). */
export function redactConfig(
  sourceType: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...config };
  if (sourceType === "imap" && "password" in clone) {
    clone.password = "***";
  }
  if (
    sourceType === "api" &&
    clone.auth &&
    typeof clone.auth === "object" &&
    clone.auth !== null
  ) {
    const auth = { ...(clone.auth as Record<string, unknown>) };
    if (auth.credentials && typeof auth.credentials === "object") {
      auth.credentials = Object.fromEntries(
        Object.keys(auth.credentials as Record<string, string>).map((k) => [
          k,
          "***",
        ]),
      );
    }
    clone.auth = auth;
  }
  return clone;
}

export function toPublicSource(row: SourceConfig) {
  return {
    ...row,
    config: redactConfig(row.sourceType, row.config as Record<string, unknown>),
  };
}

async function getOwnedSource(userId: string, id: string): Promise<SourceConfig> {
  const [row] = await db
    .select()
    .from(sourceConfigs)
    .where(and(eq(sourceConfigs.id, id), eq(sourceConfigs.userId, userId)))
    .limit(1);
  if (!row) throw new SourceError("Source not found", 404);
  return row;
}

export async function listSources(userId: string) {
  const rows = await db
    .select()
    .from(sourceConfigs)
    .where(eq(sourceConfigs.userId, userId))
    .orderBy(desc(sourceConfigs.createdAt));
  return { sources: rows.map(toPublicSource) };
}

export async function getSource(userId: string, id: string) {
  const row = await getOwnedSource(userId, id);
  return { sourceConfig: toPublicSource(row) };
}

export async function createSource(userId: string, body: CreateSourceBody) {
  const [created] = await db
    .insert(sourceConfigs)
    .values({
      userId,
      sourceType: body.sourceType,
      name: body.name,
      description: body.description ?? null,
      config: body.config,
      scheduleCron: body.scheduleCron ?? null,
      timezone: body.timezone ?? "UTC",
      isActive: body.isActive ?? true,
      rateLimitPerMinute: body.rateLimitPerMinute,
      rateLimitPerHour: body.rateLimitPerHour,
      keywordFilters: body.keywordFilters,
      locationFilters: body.locationFilters,
      companyFilters: body.companyFilters,
      salaryMin: body.salaryMin,
      experienceLevels: body.experienceLevels,
    })
    .returning();

  if (!created) throw new Error("Failed to create source");
  return { sourceConfig: toPublicSource(created) };
}

export async function patchSource(
  userId: string,
  id: string,
  body: PatchSourceBody,
) {
  const existing = await getOwnedSource(userId, id);

  if (body.config) {
    const schema = sourceConfigByType[existing.sourceType as SourceType];
    if (!schema) throw new SourceError("Unsupported source type", 400);
    const parsed = schema.safeParse(body.config);
    if (!parsed.success) {
      throw new SourceError(
        parsed.error.issues[0]?.message ?? "Invalid config",
        400,
      );
    }
  }

  const [updated] = await db
    .update(sourceConfigs)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(sourceConfigs.id, id), eq(sourceConfigs.userId, userId)))
    .returning();

  if (!updated) throw new SourceError("Source not found", 404);
  return { sourceConfig: toPublicSource(updated) };
}

export async function deleteSource(userId: string, id: string) {
  const result = await db
    .delete(sourceConfigs)
    .where(and(eq(sourceConfigs.id, id), eq(sourceConfigs.userId, userId)))
    .returning({ id: sourceConfigs.id });
  if (result.length === 0) throw new SourceError("Source not found", 404);
  return { success: true as const };
}

/**
 * Dry-run / connectivity test — does not persist jobs.
 * Never logs IMAP passwords or API credentials (HG-8).
 */
export async function testSource(userId: string, id: string) {
  const source = await getOwnedSource(userId, id);
  const config = source.config as Record<string, unknown>;
  const errors: string[] = [];
  const sampleJobs: Array<{ title: string; company: string; url?: string }> =
    [];

  if (source.sourceType === "rss") {
    const feedUrl = String(config.feedUrl ?? "");
    try {
      const res = await fetch(feedUrl, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "JobAutomater/1.0 source-test" },
      });
      if (!res.ok) {
        errors.push(`Feed returned HTTP ${res.status}`);
      } else {
        const text = await res.text();
        const titles = [
          ...text.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>/gi),
        ]
          .slice(0, 3)
          .map((m) => m[1]?.trim() ?? "Untitled");
        if (titles.length === 0) {
          errors.push("Feed reachable but no <item> entries found");
        } else {
          for (const title of titles) {
            sampleJobs.push({ title, company: "Unknown", url: feedUrl });
          }
        }
      }
    } catch {
      errors.push("Could not reach feed URL");
    }
  } else if (source.sourceType === "api") {
    const baseUrl = String(config.baseUrl ?? "");
    try {
      const res = await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "JobAutomater/1.0 source-test" },
      });
      if (!res.ok) {
        errors.push(`API returned HTTP ${res.status}`);
      } else {
        sampleJobs.push({
          title: "API endpoint reachable",
          company: "N/A",
          url: baseUrl,
        });
      }
    } catch {
      errors.push("Could not reach API base URL");
    }
  } else if (source.sourceType === "imap") {
    const parsed = sourceConfigByType.imap.safeParse(config);
    if (!parsed.success) {
      errors.push("IMAP config incomplete");
    } else {
      sampleJobs.push({
        title: "IMAP config looks valid (live connect in collector)",
        company: String(config.imapServer ?? ""),
      });
    }
  }

  return {
    success: errors.length === 0,
    sampleJobs,
    errors,
  };
}

/** Enqueue CollectSourceJob; mark source as queued. */
export async function runSource(userId: string, id: string) {
  const source = await getOwnedSource(userId, id);
  if (!source.isActive) {
    throw new SourceError("Source is inactive", 400);
  }

  const pipelineRunId = randomUUID();
  await enqueueCollectSource({
    source_id: source.id,
    user_id: userId,
    source_type: source.sourceType,
  });

  await db
    .update(sourceConfigs)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: "queued",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(sourceConfigs.id, id), eq(sourceConfigs.userId, userId)));

  return { pipelineRunId, status: "started" as const };
}
