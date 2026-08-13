import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDatabase } from "./db/index.js";
import { env } from "./env.js";
import {
  startDailyCollectWorker,
  stopDailyCollectWorker,
} from "./lib/daily-collect.js";

const app = createApp();

const server = serve(
  {
    fetch: app.fetch,
    port: env.apiPort,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);

void startDailyCollectWorker()
  .then(() => {
    console.log("Daily collect BullMQ worker started (user TZ cron)");
  })
  .catch((err: unknown) => {
    console.error(
      JSON.stringify({
        event: "daily_collect_worker_start_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  });

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down`);
  server.close();
  await stopDailyCollectWorker().catch(() => {});
  await closeDatabase();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
