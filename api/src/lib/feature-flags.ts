/**
 * Feature flags for risky surfaces (P12.3 / beta-launch.md).
 * Server-side only — never expose secrets. Defaults fail closed for auto-apply.
 */
import { env } from "../env.js";

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export type FeatureFlags = {
  /** Experimental blind auto-apply — OFF by default (HG-4). */
  autoApplyWithoutApproval: boolean;
  /** Gmail OAuth connect UI / routes. */
  gmailOauth: boolean;
  /** Slack/Telegram webhook dispatch from workers prefs. */
  notificationWebhooks: boolean;
  /** Sentry error reporting. */
  sentry: boolean;
};

export function getFeatureFlags(): FeatureFlags {
  return {
    autoApplyWithoutApproval: truthy(process.env.FEATURE_AUTO_APPLY),
    gmailOauth: Boolean(
      env.oauthGoogleClientId && env.oauthGoogleClientSecret,
    ),
    notificationWebhooks: true,
    sentry: Boolean(env.sentryDsn),
  };
}
