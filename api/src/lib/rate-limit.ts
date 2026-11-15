import { createClient, type RedisClientType } from "redis";
import { env } from "../env.js";
export const RATE_LIMITS = {
    authenticated: 100,
    anonymous: 20,
    windowSec: 60,
} as const;
export type RateLimitKind = "authenticated" | "anonymous";
export type RateLimitResult = {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSec: number;
    kind: RateLimitKind;
};
const memory = new Map<string, {
    count: number;
    resetAt: number;
}>();
let forceMemory = false;
let redisClientFactory: typeof createClient = createClient;
const REDIS_CONNECT_TIMEOUT_MS = 200;
export function useMemoryRateLimit(enabled = true): void {
    forceMemory = enabled;
}
export function setRedisClientFactory(factory: typeof createClient | null): void {
    redisClientFactory = factory ?? createClient;
}
export function resetRateLimitMemory(): void {
    memory.clear();
}
function minuteBucket(now = Date.now()): string {
    return new Date(now).toISOString().slice(0, 16);
}
function memoryConsume(key: string, limit: number): RateLimitResult {
    const now = Date.now();
    const bucket = minuteBucket(now);
    const fullKey = `${key}:${bucket}`;
    const resetAt = Date.UTC(Number(bucket.slice(0, 4)), Number(bucket.slice(5, 7)) - 1, Number(bucket.slice(8, 10)), Number(bucket.slice(11, 13)), Number(bucket.slice(14, 16)) + 1, 0, 0) / 1000;
    const resetSec = Math.max(1, resetAt - Math.floor(now / 1000));
    let entry = memory.get(fullKey);
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + RATE_LIMITS.windowSec * 1000 };
    }
    entry.count += 1;
    memory.set(fullKey, entry);
    if (memory.size > 5000) {
        for (const [k, v] of memory) {
            if (v.resetAt <= now)
                memory.delete(k);
        }
    }
    const remaining = Math.max(0, limit - entry.count);
    return {
        allowed: entry.count <= limit,
        limit,
        remaining,
        resetSec,
        kind: key.startsWith("auth:") ? "authenticated" : "anonymous",
    };
}
async function redisConsume(key: string, limit: number, kind: RateLimitKind): Promise<RateLimitResult> {
    const client = redisClientFactory({
        url: env.redisUrl,
        socket: {
            connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
            reconnectStrategy: false,
        },
    }) as RedisClientType;
    client.on("error", () => { });
    try {
        await client.connect();
        const bucket = minuteBucket();
        const redisKey = `jobautomater:api_rl:${key}:${bucket}`;
        const count = await client.incr(redisKey);
        if (count === 1) {
            await client.expire(redisKey, RATE_LIMITS.windowSec);
        }
        const ttl = await client.ttl(redisKey);
        const resetSec = ttl > 0 ? ttl : RATE_LIMITS.windowSec;
        return {
            allowed: count <= limit,
            limit,
            remaining: Math.max(0, limit - count),
            resetSec,
            kind,
        };
    }
    finally {
        try {
            client.destroy();
        }
        catch {
            await client.quit().catch(() => { });
        }
    }
}
export async function consumeApiRateLimit(params: {
    userId?: string | null;
    anonKey: string;
}): Promise<RateLimitResult> {
    const kind: RateLimitKind = params.userId ? "authenticated" : "anonymous";
    const limit = kind === "authenticated"
        ? RATE_LIMITS.authenticated
        : RATE_LIMITS.anonymous;
    const key = params.userId
        ? `auth:${params.userId}`
        : `anon:${params.anonKey}`;
    if (forceMemory) {
        return memoryConsume(key, limit);
    }
    try {
        return await redisConsume(key, limit, kind);
    }
    catch {
        return memoryConsume(key, limit);
    }
}
export function anonKeyFromIp(ip: string | undefined): string {
    const raw = (ip ?? "unknown").split(",")[0]?.trim() || "unknown";
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
        h = (h * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}
