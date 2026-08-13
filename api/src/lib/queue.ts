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
 * Never logs CV/CL bodies (HG-8).
 */
export async function enqueueSubmitApplication(
  payload: SubmitApplicationPayload,
): Promise<void> {
  if (!payload.approved_at) {
    throw new Error("SubmitApplicationJob requires approved_at (HG-4)");
  }
  const client = createClient({ url: env.redisUrl });
  try {
    await client.connect();
    await client.lPush(
      "jobautomater:submit_application",
      JSON.stringify(payload),
    );
  } finally {
    await client.quit().catch(() => {});
  }
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
