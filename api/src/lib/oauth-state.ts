import { createClient, type RedisClientType } from "redis";
import { env } from "../env.js";

let client: RedisClientType | null = null;

async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client;
  client = createClient({
    url: env.redisUrl,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });
  client.on("error", () => {});
  await client.connect();
  return client;
}

export type OAuthStatePayload = {
  provider: string;
  codeVerifier?: string;
  userId?: string;
  purpose?: "login" | "gmail";
};

/** Store OAuth CSRF/PKCE state for 10 minutes. */
export async function saveOAuthState(
  state: string,
  payload: OAuthStatePayload,
): Promise<void> {
  const r = await getRedis();
  await r.set(`oauth:state:${state}`, JSON.stringify(payload), { EX: 600 });
}

export async function takeOAuthState(
  state: string,
): Promise<OAuthStatePayload | null> {
  const r = await getRedis();
  const key = `oauth:state:${state}`;
  const raw = await r.get(key);
  if (!raw) return null;
  await r.del(key);
  try {
    return JSON.parse(raw) as OAuthStatePayload;
  } catch {
    return null;
  }
}
