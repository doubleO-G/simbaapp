import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paystack webhook receiver.
 *
 * Public URL (use this in your Paystack Dashboard → Settings → API Keys & Webhooks):
 *   https://simbawayuda.lovable.app/api/public/paystack-webhook
 *
 * Stable preview URL (for testing against the latest preview build):
 *   https://project--02d9a3ba-8548-4c65-8120-066e7de20d5a.lovable.app/api/public/paystack-webhook
 *
 * Paystack signs every webhook with HMAC-SHA512 using your SECRET key over the
 * RAW request body and puts the hex digest in the `x-paystack-signature` header.
 * We verify that signature before trusting any payload.
 */
export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) {
          console.error("[paystack-webhook] PAYSTACK_SECRET_KEY is not configured");
          return new Response("Server misconfigured", { status: 500 });
        }

        const signature = request.headers.get("x-paystack-signature");
        const rawBody = await request.text();

        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }

        const expected = createHmac("sha512", secret).update(rawBody).digest("hex");

        let valid = false;
        try {
          const a = Buffer.from(signature, "hex");
          const b = Buffer.from(expected, "hex");
          valid = a.length === b.length && timingSafeEqual(a, b);
        } catch {
          valid = false;
        }

        if (!valid) {
          console.warn("[paystack-webhook] Invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Handle the event. Respond 200 quickly so Paystack doesn't retry.
        switch (event.event) {
          case "charge.success": {
            const data = event.data ?? {};
            console.log("[paystack-webhook] charge.success", {
              reference: data.reference,
              amount: data.amount,
              currency: data.currency,
              customer: (data.customer as { email?: string } | undefined)?.email,
              metadata: data.metadata,
            });
            // TODO: persist the order / mark partnership as funded / send branded receipt.
            break;
          }
          default:
            console.log("[paystack-webhook] event", event.event);
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () =>
        new Response("Paystack webhook endpoint. POST only.", { status: 405 }),
    },
  },
});
