import { env } from "../env.js";
function truthy(v: string | undefined): boolean {
    if (!v)
        return false;
    return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}
export type FeatureFlags = {
    autoApplyWithoutApproval: boolean;
    gmailOauth: boolean;
    notificationWebhooks: boolean;
    sentry: boolean;
};
export function getFeatureFlags(): FeatureFlags {
    return {
        autoApplyWithoutApproval: truthy(process.env.FEATURE_AUTO_APPLY),
        gmailOauth: Boolean(env.oauthGoogleClientId && env.oauthGoogleClientSecret),
        notificationWebhooks: true,
        sentry: Boolean(env.sentryDsn),
    };
}
