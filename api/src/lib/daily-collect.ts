import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { sourceConfigs, users } from "../db/schema/index.js";
import { env } from "../env.js";
import { enqueueCollectSource, enqueueEnrichCompany } from "./queue.js";

/** AppFlow §2.2 / WF-01 — 06:00 in the user's timezone (never UTC-only). */
export const DAILY_COLLECT_CRON = "0 6 * * *";
export const DAILY_COLLECT_QUEUE = "daily-collect";

export type DailyCollectJobData = {
  userId?: string;
  timezone?: string;
};

function bullmqConnection(): ConnectionOptions {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

let queue: Queue<DailyCollectJobData> | null = null;
let worker: Worker<DailyCollectJobData> | null = null;

export function getDailyCollectQueue(): Queue<DailyCollectJobData> {
  if (!queue) {
    queue = new Queue<DailyCollectJobData>(DAILY_COLLECT_QUEUE, {
      connection: bullmqConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return queue;
}

export function scheduleKey(userId: string): string {
  return `daily-user-${userId}`;
}

/**
 * Upsert a BullMQ repeatable job for this user at 06:00 in their timezone.
 * Replaces any prior schedule so TZ changes take effect (HG: no UTC-only cron).
 */
export async function ensureUserDailySchedule(
  userId: string,
  timezone: string,
): Promise<void> {
  const tz = timezone.trim() || "UTC";
  const q = getDailyCollectQueue();
  const key = scheduleKey(userId);

  const existing = await q.getRepeatableJobs();
  for (const job of existing) {
    if (job.id === key || job.name === key) {
      await q.removeRepeatableByKey(job.key);
    }
  }

  await q.add(
    "run-user-daily",
    { userId, timezone: tz },
    {
      repeat: {
        pattern: DAILY_COLLECT_CRON,
        tz,
      },
      jobId: key,
    },
  );
}

export async function removeUserDailySchedule(userId: string): Promise<void> {
  const q = getDailyCollectQueue();
  const key = scheduleKey(userId);
  const existing = await q.getRepeatableJobs();
  for (const job of existing) {
    if (job.id === key || job.name === key) {
      await q.removeRepeatableByKey(job.key);
    }
  }
}

/** Load users with at least one active source and (re)register TZ-aware schedules. */
export async function syncDailyCollectSchedules(): Promise<{ synced: number }> {
  const rows = await db
    .selectDistinct({
      userId: users.id,
      timezone: users.timezone,
    })
    .from(users)
    .innerJoin(sourceConfigs, eq(sourceConfigs.userId, users.id))
    .where(
      and(
        eq(sourceConfigs.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  for (const row of rows) {
    await ensureUserDailySchedule(row.userId, row.timezone);
  }
  return { synced: rows.length };
}

/**
 * Fan-out collect for all active sources owned by the user.
 * Uses users.timezone for logging context; schedule already TZ-aware via BullMQ.
 */
export async function runDailyCollectForUser(userId: string): Promise<{
  enqueued: number;
  skipped: number;
}> {
  const [user] = await db
    .select({ id: users.id, timezone: users.timezone, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.deletedAt) {
    await removeUserDailySchedule(userId);
    return { enqueued: 0, skipped: 0 };
  }

  const sources = await db
    .select({
      id: sourceConfigs.id,
      sourceType: sourceConfigs.sourceType,
      userId: sourceConfigs.userId,
    })
    .from(sourceConfigs)
    .where(
      and(eq(sourceConfigs.userId, userId), eq(sourceConfigs.isActive, true)),
    );

  if (sources.length === 0) {
    await removeUserDailySchedule(userId);
    return { enqueued: 0, skipped: 0 };
  }

  let enqueued = 0;
  let skipped = 0;
  for (const source of sources) {
    try {
      await db
        .update(sourceConfigs)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "queued",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(sourceConfigs.id, source.id));

      await enqueueCollectSource({
        source_id: source.id,
        user_id: source.userId,
        source_type: source.sourceType,
      });
      enqueued += 1;
    } catch {
      skipped += 1;
      await db
        .update(sourceConfigs)
        .set({
          lastRunStatus: "failed",
          lastError: "Daily collect enqueue failed",
          updatedAt: new Date(),
        })
        .where(eq(sourceConfigs.id, source.id));
    }
  }

  // Optional enrichment pass for recent unscored/scored jobs missing company domain
  try {
    await enqueueEnrichCompany({ user_id: userId, job_ids: [] });
  } catch {
    // enrichment is best-effort
  }

  return { enqueued, skipped };
}

export async function startDailyCollectWorker(): Promise<Worker<DailyCollectJobData>> {
  if (worker) return worker;

  worker = new Worker<DailyCollectJobData>(
    DAILY_COLLECT_QUEUE,
    async (job) => {
      if (job.name === "run-user-daily") {
        if (!job.data.userId) throw new Error("run-user-daily requires userId");
        return runDailyCollectForUser(job.data.userId);
      }
      if (job.name === "sync-schedules") {
        return syncDailyCollectSchedules();
      }
      return { ignored: true };
    },
    { connection: bullmqConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(
      JSON.stringify({
        event: "daily_collect_failed",
        jobId: job?.id,
        name: job?.name,
        error: err.message,
      }),
    );
  });

  // Periodic resync so new users/sources get schedules without restart
  const q = getDailyCollectQueue();
  await q.add(
    "sync-schedules",
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "daily-collect-sync",
    },
  );

  await syncDailyCollectSchedules();
  return worker;
}

export async function stopDailyCollectWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
