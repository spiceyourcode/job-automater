import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import * as billingService from "./billing.service.js";

export const billingRoutes = new Hono();
export const billingWebhookRoutes = new Hono();

billingRoutes.use("*", requireAuth);

billingRoutes.get("/me", async (c) => {
  return c.json(billingService.getBillingStatus(), 200);
});

billingRoutes.post("/checkout", requireRole("owner"), async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await billingService.createCheckoutSession(userId), 200);
  } catch (err) {
    if (err instanceof billingService.BillingError) {
      return c.json({ error: err.message }, err.statusCode);
    }
    throw err;
  }
});

billingWebhookRoutes.post("/", async (c) => {
  const payload = await c.req.text();
  const sig = c.req.header("stripe-signature");
  if (!billingService.verifyStripeSignature(payload, sig)) {
    return c.json({ error: "invalid_signature" }, 400);
  }
  return c.json({ received: true }, 200);
});
