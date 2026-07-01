import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrderRow = {
  id: string;
  reference: string;
  email: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  customer_name: string | null;
  items: Array<{ id?: string; name?: string; size?: string; color?: string; qty?: number; price?: number }> | null;
  tier: string | null;
  tier_name: string | null;
  created_at: string;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listAllOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email?: string } | undefined) => ({
    email: (data?.email ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data, context }): Promise<{ orders: OrderRow[] }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin as any)
      .from("orders")
      .select("id, reference, email, type, amount, currency, status, customer_name, items, tier, tier_name, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.email) q = q.ilike("email", `%${data.email}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { orders: (rows ?? []) as OrderRow[] };
  });
