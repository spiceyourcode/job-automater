import type { MiddlewareHandler } from "hono";
import { log } from "../lib/logger.js";

/** Structured access log — path/method/status/ms only (HG-8). */
export const requestLog: MiddlewareHandler = async (c, next) => {
  const started = Date.now();
  await next();
  log.info("http_request", {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - started,
  });
};
