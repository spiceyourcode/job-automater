/**
 * Sentry init — optional. DSN from env only (HG-1). Never send PII (HG-8).
 * FAILURE (P12.2): CV/email body must not appear in breadcrumbs or extras.
 */
import * as Sentry from "@sentry/node";
import { env } from "../env.js";
import { scrubForLog } from "./logger.js";

let initialized = false;

const PII_HINT =
  /\b(body_text|tailored_cv|cover_letter|password|authorization|bearer\s+[a-z0-9._-]+)\b/i;

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }
  if (event.extra) {
    event.extra = scrubForLog(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubForLog(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      const data = b.data
        ? (scrubForLog(b.data) as Record<string, unknown>)
        : undefined;
      let message = b.message;
      if (message && PII_HINT.test(message)) {
        message = "[redacted]";
      }
      return { ...b, data, message };
    });
  }
  return event;
}

export function initSentry(): void {
  if (initialized || !env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    sendDefaultPii: false,
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 0,
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubForLog(breadcrumb.data) as Record<
          string,
          unknown
        >;
      }
      if (breadcrumb.message && PII_HINT.test(breadcrumb.message)) {
        breadcrumb.message = "[redacted]";
      }
      return breadcrumb;
    },
  });
  initialized = true;
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "sentry_initialized",
      env: env.nodeEnv,
    }),
  );
}

export function captureUnhandled(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}

export async function flushSentry(): Promise<void> {
  if (!initialized) return;
  await Sentry.flush(2000);
}

/** Test helper — apply the same scrubbing as beforeSend. */
export function scrubSentryEventForTest(
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent | null {
  return scrubEvent(event);
}

export { Sentry };
