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
