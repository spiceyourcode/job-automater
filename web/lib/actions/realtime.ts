"use server";

import { getAccessToken } from "@/lib/auth-token";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export async function getWsTicketAction(): Promise<
  { ok: true; ticket: string } | { ok: false; error: string }
> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/realtime/ticket`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Could not open realtime" };
    const body = (await res.json()) as { ticket: string };
    return { ok: true, ticket: body.ticket };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
