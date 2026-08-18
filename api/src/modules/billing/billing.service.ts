import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../env.js";

export class BillingError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 503,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export function getBillingStatus() {
  return {
    configured: Boolean(env.stripeSecretKey && env.stripePriceId),
    plan: "free" as const,
  };
}

export async function createCheckoutSession(userId: string) {
  if (!env.stripeSecretKey || !env.stripePriceId) {
    throw new BillingError("Billing is not configured", 503);
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "subscription",
      success_url: `${env.appUrl}/settings/team?billing=success`,
      cancel_url: `${env.appUrl}/settings/team?billing=cancel`,
      client_reference_id: userId,
      "line_items[0][price]": env.stripePriceId,
      "line_items[0][quantity]": "1",
    }),
  });
  if (!res.ok) {
    throw new BillingError("Checkout failed", 503);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new BillingError("Checkout failed", 503);
  return { url: data.url };
}

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | undefined,
): boolean {
  const secret = env.stripeWebhookSecret;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v ?? ""];
    }),
  );
  const signed = `${parts.t}.${payload}`;
  const digest = createHmac("sha256", secret).update(signed).digest("hex");
  const expected = parts.v1 ?? "";
  if (digest.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
  } catch {
    return false;
  }
}
