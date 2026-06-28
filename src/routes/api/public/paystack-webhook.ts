import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paystack webhook receiver.
 *
 * Public URL (configure in Paystack Dashboard → Settings → API Keys & Webhooks):
 *   https://simbawayuda.lovable.app/api/public/paystack-webhook
 *
 * Stable preview URL (for testing):
 *   https://project--02d9a3ba-8548-4c65-8120-066e7de20d5a.lovable.app/api/public/paystack-webhook
 *
 * Verifies the `x-paystack-signature` HMAC-SHA512 of the raw body using
 * PAYSTACK_SECRET_KEY, then routes the event to the merch or partner flow
 * based on metadata.type / reference prefix.
 */

type PaystackCustomer = { email?: string; first_name?: string; last_name?: string };

type PaystackChargeData = {
  reference?: string;
  amount?: number; // minor units (kobo/cents)
  currency?: string;
  status?: string;
  paid_at?: string;
  customer?: PaystackCustomer;
  metadata?: Record<string, unknown> | null;
};

type PaystackEvent = {
  event?: string;
  data?: PaystackChargeData;
};

type FlowType = "merch" | "partner" | "unknown";

function classifyFlow(data: PaystackChargeData): FlowType {
  const metaType =
    data.metadata && typeof data.metadata === "object"
      ? String((data.metadata as Record<string, unknown>).type ?? "")
      : "";
  if (metaType === "merchandise") return "merch";
  if (metaType === "partnership") return "partner";

  const ref = data.reference ?? "";
  if (ref.startsWith("swy-merch-")) return "merch";
  if (ref.startsWith("swy-partner-")) return "partner";
  return "unknown";
}

async function persistOrder(flow: FlowType, data: PaystackChargeData) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const customerName = [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(" ") || null;
  const items = Array.isArray((meta as { items?: unknown }).items) ? (meta as { items: unknown[] }).items : null;
  const { error } = await supabaseAdmin.from("orders").upsert(
    {
      reference: data.reference!,
      email: (data.customer?.email ?? "").toLowerCase(),
      type: flow === "partner" ? "partner" : "merch",
      amount: (data.amount ?? 0) / 100,
      currency: data.currency ?? "KES",
      status: data.status ?? "success",
      customer_name: customerName,
      items: (items ?? null) as never,
      tier: typeof meta.tier === "string" ? (meta.tier as string) : null,
      tier_name: typeof meta.tier_name === "string" ? (meta.tier_name as string) : null,
      metadata: meta as never,
    },
    { onConflict: "reference" },
  );
  if (error) console.error("[paystack-webhook] failed to persist order", error);
}

async function handleMerchSuccess(data: PaystackChargeData) {
  console.log("[paystack-webhook] merch payment success", {
    reference: data.reference,
    amount: data.amount,
    customer: data.customer?.email,
  });
  await persistOrder("merch", data);
}

async function handlePartnerSuccess(data: PaystackChargeData) {
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  console.log("[paystack-webhook] partner sponsorship success", {
    reference: data.reference,
    amount: data.amount,
    customer: data.customer?.email,
    tier: meta.tier,
    tier_name: meta.tier_name,
  });
  await persistOrder("partner", data);
}

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
        if (!signature) return new Response("Missing signature", { status: 401 });

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

        let event: PaystackEvent;
        try {
          event = JSON.parse(rawBody) as PaystackEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (event.event !== "charge.success" || !event.data) {
          console.log("[paystack-webhook] ignored event", event.event);
          return new Response("ok", { status: 200 });
        }

        const data = event.data;
        if (data.status && data.status !== "success") {
          console.log("[paystack-webhook] non-success status", data.status);
          return new Response("ok", { status: 200 });
        }

        const flow = classifyFlow(data);
        try {
          if (flow === "merch") {
            await handleMerchSuccess(data);
          } else if (flow === "partner") {
            await handlePartnerSuccess(data);
          } else {
            console.warn("[paystack-webhook] unknown flow for reference", data.reference);
          }
        } catch (err) {
          console.error("[paystack-webhook] handler error", err);
          // Still return 200 so Paystack doesn't retry indefinitely; logged for review.
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () =>
        new Response("Paystack webhook endpoint. POST only.", { status: 405 }),
    },
  },
});
