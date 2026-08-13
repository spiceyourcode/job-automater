import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sourceConfigs, type SourceConfig } from "../../db/schema/index.js";
import { enqueueCollectSource } from "../../lib/queue.js";
import { assertPublicHttpUrl } from "../../lib/safe-url.js";
import {
  sourceConfigByType,
  type CreateSourceBody,
  type PatchSourceBody,
  type SourceType,
} from "./sources.schema.js";

const REDACTED = "***";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 503,
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
    clone.password = REDACTED;
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
          REDACTED,
        ]),
      );
    }
    clone.auth = auth;
  }
  if (
    sourceType === "playwright" &&
    clone.login &&
    typeof clone.login === "object" &&
    clone.login !== null
  ) {
    const login = { ...(clone.login as Record<string, unknown>) };
    if ("password" in login) login.password = REDACTED;
    if ("username" in login) login.username = REDACTED;
    clone.login = login;
  }
  return clone;
}

/**
 * When clients round-trip redacted GET config on PATCH, keep stored secrets.
 */
export function mergePreservedSecrets(
  sourceType: string,
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };

  if (sourceType === "imap" && merged.password === REDACTED) {
    merged.password = existing.password;
  }

  if (
    sourceType === "playwright" &&
    merged.login &&
    typeof merged.login === "object" &&
    merged.login !== null
  ) {
    const login = { ...(merged.login as Record<string, unknown>) };
    const existingLogin =
      existing.login && typeof existing.login === "object" && existing.login !== null
        ? (existing.login as Record<string, unknown>)
        : {};
    if (login.password === REDACTED) login.password = existingLogin.password;
    if (login.username === REDACTED) login.username = existingLogin.username;
    merged.login = login;
  }

  if (
    sourceType === "api" &&
    merged.auth &&
    typeof merged.auth === "object" &&
    merged.auth !== null
  ) {
    const auth = { ...(merged.auth as Record<string, unknown>) };
    const existingAuth =
      existing.auth && typeof existing.auth === "object" && existing.auth !== null
        ? (existing.auth as Record<string, unknown>)
        : {};
    const existingCreds =
      existingAuth.credentials &&
      typeof existingAuth.credentials === "object" &&
      existingAuth.credentials !== null
        ? (existingAuth.credentials as Record<string, string>)
        : {};

    if (auth.credentials && typeof auth.credentials === "object") {
      auth.credentials = Object.fromEntries(
        Object.entries(auth.credentials as Record<string, string>).map(
          ([k, v]) => [k, v === REDACTED ? (existingCreds[k] ?? v) : v],
        ),
      );
    }
    merged.auth = auth;
  }

  return merged;
}

function parseTypedConfig(
  sourceType: SourceType,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const schema = sourceConfigByType[sourceType];
  if (!schema) throw new SourceError("Unsupported source type", 400);
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    throw new SourceError(
      parsed.error.issues[0]?.message ?? "Invalid config",
      400,
    );
  }
  return parsed.data as Record<string, unknown>;
}

export function toPublicSource(row: SourceConfig) {
  return {
    ...row,
    config: redactConfig(row.sourceType, row.config as Record<string, unknown>),
  };
}

async function getWorkspaceSource(
  workspaceId: string,
  id: string,
): Promise<SourceConfig> {
  const [row] = await db
    .select()
    .from(sourceConfigs)
    .where(
      and(eq(sourceConfigs.id, id), eq(sourceConfigs.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!row) throw new SourceError("Source not found", 404);
  return row;
}

export async function listSources(workspaceId: string) {
  const rows = await db
    .select()
    .from(sourceConfigs)
    .where(eq(sourceConfigs.workspaceId, workspaceId))
    .orderBy(desc(sourceConfigs.createdAt));
  return { sources: rows.map(toPublicSource) };
}

export async function getSource(workspaceId: string, id: string) {
  const row = await getWorkspaceSource(workspaceId, id);
  return { sourceConfig: toPublicSource(row) };
}

export async function createSource(
  userId: string,
  workspaceId: string,
  body: CreateSourceBody,
) {
  const config = parseTypedConfig(body.sourceType, body.config);

  const [created] = await db
    .insert(sourceConfigs)
    .values({
      userId,
      workspaceId,
      sourceType: body.sourceType,
      name: body.name,
      description: body.description ?? null,
      config,
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
  workspaceId: string,
  id: string,
  body: PatchSourceBody,
) {
  const existing = await getWorkspaceSource(workspaceId, id);
  const sourceType = existing.sourceType as SourceType;

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };

  if (body.config) {
    const merged = mergePreservedSecrets(
      sourceType,
      body.config,
      existing.config as Record<string, unknown>,
    );
    updates.config = parseTypedConfig(sourceType, merged);
  }

  const [updated] = await db
    .update(sourceConfigs)
    .set(updates)
    .where(
      and(eq(sourceConfigs.id, id), eq(sourceConfigs.workspaceId, workspaceId)),
    )
    .returning();

  if (!updated) throw new SourceError("Source not found", 404);
  return { sourceConfig: toPublicSource(updated) };
}

export async function deleteSource(workspaceId: string, id: string) {
  const result = await db
    .delete(sourceConfigs)
    .where(
      and(eq(sourceConfigs.id, id), eq(sourceConfigs.workspaceId, workspaceId)),
    )
    .returning({ id: sourceConfigs.id });
  if (result.length === 0) throw new SourceError("Source not found", 404);
  return { success: true as const };
}

/**
 * Dry-run / connectivity test — does not persist jobs.
 * Never logs IMAP passwords or API credentials (HG-8).
 */
export async function testSource(workspaceId: string, id: string) {
  const source = await getWorkspaceSource(workspaceId, id);
  const config = source.config as Record<string, unknown>;
  const errors: string[] = [];
  const sampleJobs: Array<{ title: string; company: string; url?: string }> =
    [];

  if (source.sourceType === "rss") {
    const feedUrl = String(config.feedUrl ?? "");
    try {
      await assertPublicHttpUrl(feedUrl);
      const res = await fetch(feedUrl, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "JobAutomater/1.0 source-test" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        errors.push("Redirects are not followed for source tests");
      } else if (!res.ok) {
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
    } catch (err) {
      errors.push(
        err instanceof Error && err.message.includes("not allowed")
          ? err.message
          : err instanceof Error && err.message.includes("Private")
            ? err.message
            : err instanceof Error && err.message.includes("Host")
              ? err.message
              : "Could not reach feed URL",
      );
    }
  } else if (source.sourceType === "api") {
    const baseUrl = String(config.baseUrl ?? "");
    try {
      await assertPublicHttpUrl(baseUrl);
      const res = await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "JobAutomater/1.0 source-test" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        errors.push("Redirects are not followed for source tests");
      } else if (!res.ok) {
        errors.push(`API returned HTTP ${res.status}`);
      } else {
        sampleJobs.push({
          title: "API endpoint reachable",
          company: "N/A",
          url: baseUrl,
        });
      }
    } catch (err) {
      errors.push(
        err instanceof Error &&
          (err.message.includes("not allowed") ||
            err.message.includes("Private") ||
            err.message.includes("Host") ||
            err.message.includes("credentials"))
          ? err.message
          : "Could not reach API base URL",
      );
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
  } else if (
    source.sourceType === "playwright" ||
    source.sourceType === "career_page"
  ) {
    const schema =
      source.sourceType === "playwright"
        ? sourceConfigByType.playwright
        : sourceConfigByType.career_page;
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      errors.push("Scraper config incomplete — check URL and CSS selectors");
    } else {
      const startUrl =
        source.sourceType === "playwright"
          ? String(config.startUrl ?? "")
          : String(config.baseUrl ?? "");
      try {
        await assertPublicHttpUrl(startUrl);
        sampleJobs.push({
          title: "Scraper config valid (Run Now executes Playwright)",
          company: String(config.jobCardSelector ?? ""),
          url: startUrl,
        });
      } catch (err) {
        errors.push(
          err instanceof Error &&
            (err.message.includes("not allowed") ||
              err.message.includes("Private") ||
              err.message.includes("Host"))
            ? err.message
            : "Start URL is not a public http(s) URL",
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    sampleJobs,
    errors,
  };
}

/** Enqueue CollectSourceJob; mark source as queued before publish. */
export async function runSource(
  userId: string,
  workspaceId: string,
  id: string,
) {
  const source = await getWorkspaceSource(workspaceId, id);
  if (!source.isActive) {
    throw new SourceError("Source is inactive", 400);
  }

  const pipelineRunId = randomUUID();

  // Persist queued first so UI never lags a published job
  await db
    .update(sourceConfigs)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: "queued",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(sourceConfigs.id, id), eq(sourceConfigs.workspaceId, workspaceId)),
    );

  try {
    await enqueueCollectSource({
      source_id: source.id,
      user_id: userId,
      source_type: source.sourceType,
    });
  } catch {
    await db
      .update(sourceConfigs)
      .set({
        lastRunStatus: "failed",
        lastError: "Failed to enqueue collection job",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sourceConfigs.id, id),
          eq(sourceConfigs.workspaceId, workspaceId),
        ),
      );
    throw new SourceError("Failed to enqueue collection job", 503);
  }

  return { status: "queued" as const, pipelineRunId };
}
