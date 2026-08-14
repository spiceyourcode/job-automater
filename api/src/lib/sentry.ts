/**
 * Sentry init — optional. DSN from env only (HG-1). Never send PII (HG-8).
 */
import * as Sentry from "@sentry/node";
import { env } from "../env.js";

let initialized = false;

export function initSentry(): void {
  if (initialized || !env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    sendDefaultPii: false,
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }
      return event;
    },
  });
  initialized = true;
  console.info("sentry_initialized env=%s", env.nodeEnv);
}

export function captureUnhandled(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}

export async function flushSentry(): Promise<void> {
  if (!initialized) return;
  await Sentry.flush(2000);
}

export { Sentry };
