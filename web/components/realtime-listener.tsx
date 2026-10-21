"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWsTicketAction } from "@/lib/actions/realtime";
import { pushToast } from "@/lib/toast-store";

function wsBase(): string {
  const http = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.NEXT_PUBLIC_API_PORT ?? "4001"}`;
  return http.replace(/^http/, "ws");
}

/** JWT-auth WS via one-time ticket — events are user-scoped on the server. */
export function RealtimeListener() {
  const router = useRouter();
  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      try {
        const res = await getWsTicketAction();
        if (!res.ok || closed) return;
        ws = new WebSocket(`${wsBase()}/api/v1/ws?ticket=${res.ticket}`);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: "subscribe",
              channels: ["notifications", "applications"],
            }),
          );
          ping = setInterval(() => {
            ws?.send(JSON.stringify({ type: "ping" }));
          }, 25000);
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as {
              type?: string;
              application_id?: string;
              status?: string;
              error?: string;
            };
            if (data.type === "notification") {
              window.dispatchEvent(new Event("jobautomater:notification"));
            }
            if (data.type === "documents_ready") {
              window.dispatchEvent(
                new CustomEvent("jobautomater:documents", { detail: data }),
              );
              const href = data.application_id
                ? `/applications/${data.application_id}/review`
                : null;
              if (data.status === "error") {
                pushToast({
                  id: data.application_id
                    ? `docs-error-${data.application_id}`
                    : "docs-error",
                  title: "Draft generation failed",
                  description:
                    data.error ?? "Regenerate the draft from the jobs board.",
                  actionLabel: href ? "Open" : undefined,
                  onAction: href ? () => router.push(href) : undefined,
                  duration: 8000,
                });
              } else {
                pushToast({
                  id: data.application_id
                    ? `docs-${data.application_id}`
                    : "docs-ready",
                  title: "Draft ready",
                  description: "Review and approve your tailored documents.",
                  actionLabel: href ? "Review" : undefined,
                  onAction: href ? () => router.push(href) : undefined,
                  duration: 8000,
                });
              }
            }
          } catch {
            // ignore malformed
          }
        };
      } catch {
        // Ticket action transport errors must not crash the shell
      }
    };

    void connect();
    return () => {
      closed = true;
      if (ping) clearInterval(ping);
      ws?.close();
    };
  }, [router]);

  return null;
}
