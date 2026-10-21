import { cookies } from "next/headers";
import { decodeJwt } from "jose";

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001";

const ACCESS_EXPIRY_SKEW_MS = 5_000;
const REFRESH_TIMEOUT_MS = 2_500;
const ACCESS_MAX_AGE_FALLBACK_SECONDS = 60 * 60;
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type TokenPair = { accessToken: string; refreshToken: string };

type RefreshOutcome =
  | { status: "success"; tokens: TokenPair }
  | { status: "unauthorized" }
  | { status: "error" };

let inFlight: { refreshToken: string; promise: Promise<RefreshOutcome> } | null =
  null;

function accessTokenNeedsRefresh(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp !== "number") return true;
    return exp * 1000 <= Date.now() + ACCESS_EXPIRY_SKEW_MS;
  } catch {
    return true;
  }
}

function accessTokenMaxAge(token: string): number {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp === "number") {
      return Math.max(0, Math.floor(exp - Date.now() / 1000));
    }
  } catch {
    // fall through to default
  }
  return ACCESS_MAX_AGE_FALLBACK_SECONDS;
}

async function requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return { status: "error" };
  }

  if (res.status === 401) return { status: "unauthorized" };
  if (!res.ok) return { status: "error" };

  const data = (await res.json().catch(() => null)) as
    | { accessToken?: unknown; refreshToken?: unknown }
    | null;
  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.refreshToken !== "string"
  ) {
    return { status: "error" };
  }
  return {
    status: "success",
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    },
  };
}

function refreshOnce(refreshToken: string): Promise<RefreshOutcome> {
  if (inFlight?.refreshToken === refreshToken) return inFlight.promise;
  const promise = requestRefresh(refreshToken);
  inFlight = { refreshToken, promise };
  void promise.finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  return promise;
}

async function persistTokens(tokens: TokenPair): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("access_token", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: accessTokenMaxAge(tokens.accessToken),
    path: "/",
  });
  cookieStore.set("refresh_token", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_MAX_AGE_SECONDS,
    path: "/",
  });
}

/**
 * Returns a usable access token, refreshing it first when it is expired or
 * about to expire. Call only from Server Actions (cookie writes are required).
 * Never throws: on refresh failure the existing token is returned when
 * present, otherwise null.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const existing = cookieStore.get("access_token")?.value;

  if (existing && !accessTokenNeedsRefresh(existing)) return existing;

  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!refreshToken) return existing ?? null;

  const outcome = await refreshOnce(refreshToken);
  if (outcome.status === "unauthorized") return null;
  if (outcome.status === "error") return existing ?? null;

  await persistTokens(outcome.tokens);
  return outcome.tokens.accessToken;
}
