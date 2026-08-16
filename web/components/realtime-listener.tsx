"use client";

import { useEffect } from "react";
import { getWsTicketAction } from "@/lib/actions/realtime";

function wsBase(): string {
  const http =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return http.replace(/^http/, "ws");
}

/** JWT-auth WS via one-time ticket — events are user-scoped on the server. */
export function RealtimeListener() {
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
            const data = JSON.parse(String(ev.data)) as { type?: string };
            if (data.type === "notification") {
              window.dispatchEvent(new Event("jobautomater:notification"));
            }
            if (data.type === "documents_ready") {
              window.dispatchEvent(new Event("jobautomater:documents"));
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
  }, []);

  return null;
}
