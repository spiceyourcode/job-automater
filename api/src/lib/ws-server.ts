import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import { createClient, type RedisClientType } from "redis";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../env.js";
import {
  WS_PATH,
  fanoutLocal,
  handleClientMessage,
  registerSocket,
  resolveWsUserId,
  unregisterSocket,
} from "./realtime.js";

let subscriber: RedisClientType | null = null;
let wss: WebSocketServer | null = null;

async function startRedisSubscriber(): Promise<void> {
  if (subscriber?.isOpen) return;
  try {
    subscriber = createClient({ url: env.redisUrl }) as RedisClientType;
    await subscriber.connect();
    await subscriber.pSubscribe("jobautomater:ws:*", (message, channel) => {
      const prefix = "jobautomater:ws:";
      if (!channel.startsWith(prefix)) return;
      const userId = channel.slice(prefix.length);
      if (!userId) return;
      fanoutLocal(userId, message);
    });
  } catch {
    subscriber = null;
  }
}

export async function attachWebSocket(server: Server): Promise<void> {
  wss = new WebSocketServer({ noServer: true });
  await startRedisSubscriber();

  server.on(
    "upgrade",
    (request, socket: Duplex, head: Buffer) => {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "/", `http://${host}`);
      if (url.pathname !== WS_PATH) {
        socket.destroy();
        return;
      }
      void (async () => {
        const userId = await resolveWsUserId(url);
        if (!userId) {
          socket.write(
            "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n",
          );
          socket.destroy();
          return;
        }
        if (!wss) {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          registerSocket(userId, ws);
          ws.on("message", (data) => {
            handleClientMessage(userId, String(data), (payload) => {
              if (ws.readyState === ws.OPEN) ws.send(payload);
            });
          });
          ws.on("close", () => unregisterSocket(userId, ws));
          ws.on("error", () => unregisterSocket(userId, ws));
        });
      })();
    },
  );
}

export async function stopWebSocket(): Promise<void> {
    if (subscriber?.isOpen) {
    await subscriber.pUnsubscribe().catch(() => {});
    await subscriber.quit().catch(() => {});
  }
  subscriber = null;
  wss?.close();
  wss = null;
}
