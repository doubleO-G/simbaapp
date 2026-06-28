import { createServerFn } from "@tanstack/react-start";

const LOOKUP_PASSWORD = "lionofjudah2025";

export type OrderRow = {
  id: string;
  reference: string;
  email: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  customer_name: string | null;
  items: Array<{ id?: string; name?: string; size?: string; qty?: number; price?: number }> | null;
  tier: string | null;
  tier_name: string | null;
  created_at: string;
};

export const lookupOrders = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => {
    if (!data || typeof data.email !== "string" || typeof data.password !== "string") {
      throw new Error("Invalid input");
    }
    return { email: data.email.trim().toLowerCase(), password: data.password };
  })
  .handler(async ({ data }): Promise<{ orders: OrderRow[] }> => {
    if (data.password !== LOOKUP_PASSWORD) {
      throw new Error("Unauthorized");
    }
    if (!data.email) return { orders: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin.from("orders" as never) as never)
      .select("id, reference, email, type, amount, currency, status, customer_name, items, tier, tier_name, created_at")
      .ilike("email", data.email)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error((error as { message: string }).message);
    return { orders: (rows ?? []) as OrderRow[] };
  });
