/**
 * Gmail API helpers — mailbox OAuth, watch, history (P11.1).
 * Never logs tokens, email bodies, or snippets (HG-8).
 */
import { env } from "../env.js";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export type GmailTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
};

export type GmailHeaderMsg = {
  externalId: string;
  threadId?: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  receivedAt?: string;
};

export function isGmailOAuthConfigured(): boolean {
  return Boolean(env.oauthGoogleClientId && env.oauthGoogleClientSecret);
}

export function gmailRedirectUri(): string {
  return `${env.apiPublicUrl}/api/v1/auth/gmail/callback`;
}

export function buildGmailAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  if (!isGmailOAuthConfigured()) {
    throw new Error("Gmail OAuth is not configured");
  }
  const q = new URLSearchParams({
    client_id: env.oauthGoogleClientId!,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    state: params.state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export async function exchangeGmailCode(
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GmailTokens> {
  const body = new URLSearchParams({
    client_id: env.oauthGoogleClientId ?? "",
    client_secret: env.oauthGoogleClientSecret ?? "",
    code,
    redirect_uri: gmailRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error("gmail_token_exchange_failed");
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("gmail_missing_access_token");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function refreshGmailAccessToken(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GmailTokens> {
  const body = new URLSearchParams({
    client_id: env.oauthGoogleClientId ?? "",
    client_secret: env.oauthGoogleClientSecret ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error("gmail_token_refresh_failed");
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("gmail_missing_access_token");
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function fetchGmailProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ email: string; historyId?: string }> {
  const res = await fetchImpl(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error("gmail_profile_failed");
  const json = (await res.json()) as {
    emailAddress?: string;
    historyId?: string;
  };
  if (!json.emailAddress) throw new Error("gmail_profile_incomplete");
  return { email: json.emailAddress.toLowerCase(), historyId: json.historyId };
}

export async function startGmailWatch(
  accessToken: string,
  topicName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ historyId?: string; expirationMs?: number }> {
  const res = await fetchImpl(
    "https://gmail.googleapis.com/gmail/v1/users/me/watch",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ topicName, labelIds: ["INBOX"] }),
    },
  );
  if (!res.ok) throw new Error("gmail_watch_failed");
  const json = (await res.json()) as {
    historyId?: string;
    expiration?: string;
  };
  return {
    historyId: json.historyId,
    expirationMs: json.expiration ? Number(json.expiration) : undefined,
  };
}

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: Array<{ name: string; value: string }>;
};

function decodeB64Url(data: string): string {
  const pad = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(pad, "base64").toString("utf8");
}

export function extractPlainText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeB64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const text = extractPlainText(child);
    if (text) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeB64Url(part.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (m?.[2]) {
    return { email: m[2].trim().toLowerCase(), name: m[1]?.trim() || undefined };
  }
  const email = raw.replace(/[<>]/g, "").trim().toLowerCase();
  return { email };
}

export function gmailMessageToIngest(raw: {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}): GmailHeaderMsg | null {
  const id = raw.id;
  if (!id) return null;
  const headers = raw.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    "";
  const from = parseFrom(get("From"));
  if (!from.email || !from.email.includes("@")) return null;
  const receivedMs = raw.internalDate ? Number(raw.internalDate) : Date.now();
  return {
    externalId: id,
    threadId: raw.threadId,
    fromEmail: from.email,
    fromName: from.name,
    subject: get("Subject") || undefined,
    snippet: raw.snippet,
    bodyText: extractPlainText(raw.payload) || undefined,
    receivedAt: new Date(receivedMs).toISOString(),
  };
}

export async function listHistoryMessageIds(
  accessToken: string,
  startHistoryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ids: string[]; latestHistoryId?: string; expired: boolean }> {
  const url = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/history",
  );
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  const res = await fetchImpl(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) {
    return { ids: [], expired: true };
  }
  if (!res.ok) throw new Error("gmail_history_failed");
  const json = (await res.json()) as {
    historyId?: string;
    history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
  };
  const ids: string[] = [];
  for (const h of json.history ?? []) {
    for (const added of h.messagesAdded ?? []) {
      if (added.message?.id) ids.push(added.message.id);
    }
  }
  return { ids: [...new Set(ids)], latestHistoryId: json.historyId, expired: false };
}

export async function listRecentMessageIds(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ids: string[]; historyId?: string }> {
  const url = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  );
  url.searchParams.set("q", "newer_than:90d in:inbox");
  url.searchParams.set("maxResults", "50");
  const res = await fetchImpl(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("gmail_messages_list_failed");
  const json = (await res.json()) as {
    messages?: Array<{ id?: string }>;
  };
  const profile = await fetchGmailProfile(accessToken, fetchImpl);
  return {
    ids: (json.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id)),
    historyId: profile.historyId,
  };
}

export async function getGmailMessage(
  accessToken: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GmailHeaderMsg | null> {
  const res = await fetchImpl(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as Parameters<typeof gmailMessageToIngest>[0];
  return gmailMessageToIngest(json);
}

export function decodePushData(base64: string): {
  emailAddress?: string;
  historyId?: number | string;
} {
  const json = decodeB64Url(base64);
  try {
    return JSON.parse(json) as {
      emailAddress?: string;
      historyId?: number | string;
    };
  } catch {
    return {};
  }
}
