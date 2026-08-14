/**
 * Submit rate limits + emergency stop (P10.3 / FR-AA-07).
 * Redis-backed; never logs PII (HG-8).
 */
import { createClient, type RedisClientType } from "redis";
import { env } from "../env.js";

export const SUBMIT_QUEUE_KEY = "jobautomater:submit_application";

/** Defaults — configurable via env later if needed. */
export const SUBMIT_LIMITS = {
  perSitePerMinute: 2,
  perSitePerDay: 20,
  globalPerDay: 50,
} as const;

export class SubmitLimitError extends Error {
  constructor(
    message: string,
    readonly code: "emergency_stop" | "rate_limited",
  ) {
    super(message);
    this.name = "SubmitLimitError";
  }
}

function stopKey(userId: string) {
  return `jobautomater:submit_stop:${userId}`;
}

function dayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function minuteStamp(d = new Date()) {
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

export function siteKeyFromUrl(url: string | null | undefined): string {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.")) return "indeed";
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("myworkdayjobs.com")) return "workday";
    if (host.includes("ashbyhq.com")) return "ashby";
    return host || "unknown";
  } catch {
    return "unknown";
  }
}

async function withRedis<T>(fn: (c: RedisClientType) => Promise<T>): Promise<T> {
  const client = createClient({ url: env.redisUrl }) as RedisClientType;
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.quit().catch(() => {});
  }
}

export async function isEmergencyStopped(userId: string): Promise<boolean> {
  return withRedis(async (c) => {
    const v = await c.get(stopKey(userId));
    return v === "1";
  });
}

/** Activate emergency stop — blocks new enqueue + worker processing. */
export async function activateEmergencyStop(userId: string): Promise<void> {
  await withRedis(async (c) => {
    await c.set(stopKey(userId), "1");
  });
}

export async function clearEmergencyStop(userId: string): Promise<void> {
  await withRedis(async (c) => {
    await c.del(stopKey(userId));
  });
}

/**
 * Remove pending submit_application list payloads for this user.
 * Returns count removed.
 */
export async function drainUserSubmitQueue(userId: string): Promise<number> {
  return withRedis(async (c) => {
    const raw = await c.lRange(SUBMIT_QUEUE_KEY, 0, -1);
    if (raw.length === 0) return 0;
    const keep: string[] = [];
    let removed = 0;
    for (const item of raw) {
      try {
        const parsed = JSON.parse(item) as { user_id?: string };
        if (parsed.user_id === userId) {
          removed += 1;
          continue;
        }
      } catch {
        // keep malformed for other consumers to reject
      }
      keep.push(item);
    }
    await c.del(SUBMIT_QUEUE_KEY);
    if (keep.length > 0) {
      // Restore remaining jobs (lPush each to avoid TS rest-spread issues)
      for (let i = keep.length - 1; i >= 0; i -= 1) {
        const item = keep[i];
        if (item !== undefined) await c.lPush(SUBMIT_QUEUE_KEY, item);
      }
    }
    return removed;
  });
}

export async function assertCanEnqueueSubmit(
  userId: string,
  site: string,
): Promise<void> {
  await withRedis(async (c) => {
    if ((await c.get(stopKey(userId))) === "1") {
      throw new SubmitLimitError(
        "Automation emergency stop is active",
        "emergency_stop",
      );
    }
    const day = dayStamp();
    const minute = minuteStamp();
    const siteDayKey = `jobautomater:submit_rate:${userId}:${site}:day:${day}`;
    const siteMinKey = `jobautomater:submit_rate:${userId}:${site}:min:${minute}`;
    const globalDayKey = `jobautomater:submit_rate:${userId}:global:day:${day}`;

    const [siteDay, siteMin, globalDay] = await Promise.all([
      c.get(siteDayKey),
      c.get(siteMinKey),
      c.get(globalDayKey),
    ]);

    if (Number(siteMin ?? 0) >= SUBMIT_LIMITS.perSitePerMinute) {
      throw new SubmitLimitError(
        "Per-site submit rate limit exceeded (per minute)",
        "rate_limited",
      );
    }
    if (Number(siteDay ?? 0) >= SUBMIT_LIMITS.perSitePerDay) {
      throw new SubmitLimitError(
        "Per-site daily submit cap exceeded",
        "rate_limited",
      );
    }
    if (Number(globalDay ?? 0) >= SUBMIT_LIMITS.globalPerDay) {
      throw new SubmitLimitError(
        "Daily submit cap exceeded",
        "rate_limited",
      );
    }
  });
}

/** Call after a successful enqueue so caps track attempts. */
export async function recordSubmitEnqueue(
  userId: string,
  site: string,
): Promise<void> {
  await withRedis(async (c) => {
    const day = dayStamp();
    const minute = minuteStamp();
    const siteDayKey = `jobautomater:submit_rate:${userId}:${site}:day:${day}`;
    const siteMinKey = `jobautomater:submit_rate:${userId}:${site}:min:${minute}`;
    const globalDayKey = `jobautomater:submit_rate:${userId}:global:day:${day}`;

    const multi = c.multi();
    multi.incr(siteDayKey);
    multi.expire(siteDayKey, 60 * 60 * 36);
    multi.incr(siteMinKey);
    multi.expire(siteMinKey, 120);
    multi.incr(globalDayKey);
    multi.expire(globalDayKey, 60 * 60 * 36);
    await multi.exec();
  });
}
