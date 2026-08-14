import { randomBytes } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { env } from "../env.js";
import { verifyAccessToken } from "./jwt.js";

export const WS_PATH = "/api/v1/ws";

export type WsEventType =
  | "pipeline_progress"
  | "pipeline_complete"
  | "documents_ready"
  | "notification"
  | "error";

export type WsEvent = {
  type: WsEventType;
  [key: string]: unknown;
};

export function wsChannel(userId: string): string {
  return `jobautomater:ws:${userId}`;
}

/**
 * Client may only subscribe to generic own-user topics.
 * Explicit `user:{otherId}:*` channels are rejected (P11.5 FAILURE).
 */
export function isAllowedSubscribe(userId: string, channel: string): boolean {
  if (channel === "notifications" || channel === "applications") return true;
  if (channel.startsWith("pipeline_run:")) return true;
  if (channel === `user:${userId}` || channel.startsWith(`user:${userId}:`)) {
    return true;
  }
  if (channel.startsWith("user:")) return false;
  if (channel.startsWith("jobautomater:ws:")) {
    return channel === wsChannel(userId);
  }
  return false;
}

const memoryTickets = new Map<string, { userId: string; exp: number }>();

function ticketKey(ticket: string): string {
  return `jobautomater:ws:ticket:${ticket}`;
}

let redis: RedisClientType | null = null;

async function getRedis(): Promise<RedisClientType> {
  if (redis?.isOpen) return redis;
  redis = createClient({ url: env.redisUrl }) as RedisClientType;
  await redis.connect();
  return redis;
}

export async function issueWsTicket(userId: string): Promise<{
  ticket: string;
  expiresIn: number;
}> {
  const ticket = randomBytes(24).toString("hex");
  const expiresIn = 30;
  try {
    const r = await getRedis();
    await r.set(ticketKey(ticket), userId, { EX: expiresIn });
  } catch {
    memoryTickets.set(ticket, {
      userId,
      exp: Date.now() + expiresIn * 1000,
    });
  }
  return { ticket, expiresIn };
}

export async function takeWsTicket(ticket: string): Promise<string | null> {
  try {
    const r = await getRedis();
    const key = ticketKey(ticket);
    const userId = await r.get(key);
    if (userId) await r.del(key);
    if (userId) return userId;
  } catch {
    // fall through to memory
  }
  const mem = memoryTickets.get(ticket);
  memoryTickets.delete(ticket);
  if (!mem || mem.exp < Date.now()) return null;
  return mem.userId;
}

export async function resolveWsUserId(url: URL): Promise<string | null> {
  const ticket = url.searchParams.get("ticket");
  if (ticket) return takeWsTicket(ticket);
  const token = url.searchParams.get("token");
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

type SocketLike = {
  send: (data: string) => void;
  readyState: number;
  close: () => void;
};

const OPEN = 1;
const sockets = new Map<string, Set<SocketLike>>();

export function registerSocket(userId: string, ws: SocketLike): void {
  let set = sockets.get(userId);
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  set.add(ws);
}

export function unregisterSocket(userId: string, ws: SocketLike): void {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(userId);
}

export function fanoutLocal(userId: string, payload: string): void {
  const set = sockets.get(userId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === OPEN) {
      try {
        ws.send(payload);
      } catch {
        // drop
      }
    }
  }
}

/** Publish to this user's channel only — never another userId. */
export async function publishRealtime(
  userId: string,
  event: WsEvent,
): Promise<void> {
  const payload = JSON.stringify(event);
  fanoutLocal(userId, payload);
  try {
    const r = await getRedis();
    await r.publish(wsChannel(userId), payload);
  } catch {
    // local sockets still received the event
  }
}

export function handleClientMessage(
  userId: string,
  raw: string,
  send: (data: string) => void,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    send(JSON.stringify({ type: "error", code: "BAD_JSON", message: "invalid" }));
    return;
  }
  if (!parsed || typeof parsed !== "object") return;
  const msg = parsed as { type?: string; channels?: unknown };
  if (msg.type === "ping") {
    send(JSON.stringify({ type: "pong" }));
    return;
  }
  if (msg.type === "subscribe" && Array.isArray(msg.channels)) {
    const rejected = msg.channels.filter(
      (ch) => typeof ch !== "string" || !isAllowedSubscribe(userId, ch),
    );
    if (rejected.length > 0) {
      send(
        JSON.stringify({
          type: "error",
          code: "FORBIDDEN",
          message: "channel not allowed",
        }),
      );
    }
  }
}

export function resetRealtimeForTests(): void {
  sockets.clear();
  memoryTickets.clear();
}

export { sockets as _socketsForTests };
