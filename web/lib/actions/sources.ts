"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type SourcePublic = {
  id: string;
  sourceType: string;
  name: string;
  description: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  config: Record<string, unknown>;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

const createSchema = z.object({
  sourceType: z.enum([
    "rss",
    "api",
    "imap",
    "playwright",
    "career_page",
    "telegram",
  ]),
  name: z.string().min(1).max(255),
  feedUrl: z.string().url().optional(),
  baseUrl: z.string().url().optional(),
  imapServer: z.string().optional(),
  imapUsername: z.string().optional(),
  imapPassword: z.string().optional(),
  imapPort: z.coerce.number().int().positive().optional(),
  startUrl: z.string().url().optional(),
  jobListPath: z.string().optional(),
  jobCardSelector: z.string().optional(),
  titleSelector: z.string().optional(),
  urlSelector: z.string().optional(),
  maxPages: z.coerce.number().int().positive().max(20).optional(),
  botToken: z.string().optional(),
  channelId: z.string().optional(),
  messageFilter: z.string().optional(),
});

export async function listSourcesAction(): Promise<
  ActionResult<{ sources: SourcePublic[] }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/sources`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load sources" };
    const data = (await res.json()) as { sources: SourcePublic[] };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function createSourceAction(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  const d = parsed.data;
  let config: Record<string, unknown>;
  if (d.sourceType === "rss") {
    if (!d.feedUrl) return { ok: false, error: "Feed URL is required" };
    config = { feedUrl: d.feedUrl };
  } else if (d.sourceType === "api") {
    if (!d.baseUrl) return { ok: false, error: "Base URL is required" };
    config = { baseUrl: d.baseUrl, auth: { type: "none" } };
  } else if (d.sourceType === "imap") {
    if (!d.imapServer || !d.imapUsername || !d.imapPassword) {
      return { ok: false, error: "IMAP server, username, and password required" };
    }
    config = {
      imapServer: d.imapServer,
      port: d.imapPort ?? 993,
      username: d.imapUsername,
      password: d.imapPassword,
      folder: "INBOX",
    };
  } else if (d.sourceType === "playwright") {
    if (!d.startUrl || !d.jobCardSelector || !d.titleSelector) {
      return {
        ok: false,
        error: "Start URL, job card selector, and title selector required",
      };
    }
    config = {
      startUrl: d.startUrl,
      jobCardSelector: d.jobCardSelector,
      titleSelector: d.titleSelector,
      urlSelector: d.urlSelector || undefined,
      maxPages: d.maxPages ?? 1,
    };
  } else if (d.sourceType === "career_page") {
    if (!d.baseUrl || !d.jobCardSelector || !d.titleSelector) {
      return {
        ok: false,
        error: "Base URL, job card selector, and title selector required",
      };
    }
    config = {
      baseUrl: d.baseUrl,
      jobListPath: d.jobListPath || "/careers",
      jobCardSelector: d.jobCardSelector,
      titleSelector: d.titleSelector,
      urlSelector: d.urlSelector || undefined,
      maxPages: d.maxPages ?? 1,
    };
  } else if (d.sourceType === "telegram") {
    if (!d.botToken || !d.channelId) {
      return { ok: false, error: "Bot token and channel ID required" };
    }
    config = {
      botToken: d.botToken,
      channelId: d.channelId,
      messageFilter: d.messageFilter || undefined,
      limit: 50,
    };
  } else {
    return { ok: false, error: "Unsupported source type" };
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/sources`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: d.sourceType,
        name: d.name,
        config,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Create failed" };
    }
    revalidatePath("/settings/sources");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function runSourceAction(id: string): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/sources/${id}/run`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Run failed" };
    }
    revalidatePath("/settings/sources");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function testSourceAction(id: string): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/sources/${id}/test`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: string[];
      error?: string;
    };
    if (!res.ok) return { ok: false, error: body.error ?? "Test failed" };
    if (!body.success) {
      return { ok: false, error: body.errors?.[0] ?? "Test failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function deleteSourceAction(id: string): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/sources/${id}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Delete failed" };
    }
    revalidatePath("/settings/sources");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}
