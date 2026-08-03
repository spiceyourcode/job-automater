import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDatabase } from "./db/index.js";
import { env } from "./env.js";

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

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down`);
  server.close();
  await closeDatabase();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
