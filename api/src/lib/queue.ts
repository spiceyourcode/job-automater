import { createClient } from "redis";
import { env } from "../env.js";

export type CollectSourcePayload = {
  source_id: string;
  user_id: string;
  source_type: string;
};

export type GenerateDocsPayload = {
  application_id: string;
  user_id: string;
  job_id: string;
  /** P9.2 — bullets to keep verbatim when regenerating a section. */
  accepted_traces?: Array<{
    text: string;
    chunk_id: string;
    section: string;
    status?: string;
  }>;
  /** Empty / omitted = full regenerate. */
  regenerate_sections?: string[];
};

/** HG-4: approved_at is required — never enqueue without it. */
export type SubmitApplicationPayload = {
  application_id: string;
  user_id: string;
  approved_at: string;
};

export type MonitorEmailPayload = {
  user_id: string;
  messages: Array<{
    external_id: string;
    from_email: string;
    from_name?: string;
    subject?: string;
    snippet?: string;
    body_text?: string;
    received_at?: string;
  }>;
};

/**
 * Publish CollectSourceJob to Redis for Celery (HG-10).
 * Uses a simple list the workers can BRPOP in P2.2.
 * Never logs payload secrets — CollectSourceJob has none.
 */
export async function enqueueCollectSource(
  payload: CollectSourcePayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:collect_source",
      JSON.stringify(payload),
    );
  } finally {
    await client.quit().catch(() => {});
  }
}

/** Publish GenerateDocsJob — never logs document bodies (HG-8). */
export async function enqueueGenerateDocs(
  payload: GenerateDocsPayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:generate_docs",
      JSON.stringify(payload),
    );
  } finally {
    await client.quit().catch(() => {});
  }
}

/**
 * Publish SubmitApplicationJob — HG-4: rejects missing approved_at.
 * Enforces emergency stop + per-site/daily caps (P10.3 / FR-AA-07).
 * Never logs CV/CL bodies (HG-8).
 */
export async function enqueueSubmitApplication(
  payload: SubmitApplicationPayload & { site?: string },
): Promise<void> {
  if (!payload.approved_at) {
    throw new Error("SubmitApplicationJob requires approved_at (HG-4)");
  }
  const site = payload.site ?? "unknown";
  const {
    assertCanEnqueueSubmit,
    recordSubmitEnqueue,
  } = await import("./submit-limits.js");
  await assertCanEnqueueSubmit(payload.user_id, site);

  const body: SubmitApplicationPayload = {
    application_id: payload.application_id,
    user_id: payload.user_id,
    approved_at: payload.approved_at,
  };
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:submit_application",
      JSON.stringify(body),
    );
  } finally {
    await client.quit().catch(() => {});
  }
  await recordSubmitEnqueue(payload.user_id, site);
}

/** Publish MonitorEmailJob — never logs email bodies (HG-8). */
export async function enqueueMonitorEmail(
  payload: MonitorEmailPayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:monitor_email",
      JSON.stringify(payload),
    );
  } finally {
    await client.quit().catch(() => {});
  }
}

export type ReindexCvPayload = {
  task_id: string;
  user_id: string;
  cv_document_id: string;
};

/** Publish CV reindex — never logs parsed text (HG-8). */
export async function enqueueReindexCv(
  payload: ReindexCvPayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush("jobautomater:reindex_cv", JSON.stringify(payload));
  } finally {
    await client.quit().catch(() => {});
  }
}

export type MatchScorePayload = {
  job_ids: string[];
  user_id: string;
};

/** Publish MatchScoreJob for imported / rescored jobs. */
export async function enqueueMatchScore(
  payload: MatchScorePayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush("jobautomater:match_score", JSON.stringify(payload));
  } finally {
    await client.quit().catch(() => {});
  }
}

export type EnrichCompanyPayload = {
  user_id: string;
  /** Empty = enrich recent jobs for user missing company_domain. */
  job_ids: string[];
};

/** Optional company enrichment (FR-NE-03) — never logs secrets. */
export async function enqueueEnrichCompany(
  payload: EnrichCompanyPayload,
): Promise<void> {
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:enrich_company",
      JSON.stringify(payload),
    );
  } finally {
    await client.quit().catch(() => {});
  }
}
