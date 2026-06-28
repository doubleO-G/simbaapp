import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupOrders, type OrderRow } from "@/lib/orders.functions";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders Lookup — Simba wa Yuda" }] }),
  component: OrdersPage,
});

const fmt = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function OrdersPage() {
  const lookup = useServerFn(lookupOrders);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await lookup({ data: { email, password } });
      setOrders(res.orders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lookup failed");
      setOrders(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3">
            <img src="/blogo.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-display text-lg text-gold-gradient">Simba wa Yuda</span>
          </a>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to shop</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <p className="uppercase tracking-[0.3em] text-xs text-primary mb-3">Admin</p>
        <h1 className="text-4xl sm:text-5xl mb-8">Orders <span className="text-gold-gradient">Lookup</span></h1>

        <form onSubmit={submit} className="card-luxe p-6 grid sm:grid-cols-[1fr_1fr_auto] gap-3 mb-8">
          <input
            type="email"
            required
            placeholder="Customer email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            placeholder="Access password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
          <button type="submit" disabled={loading} className="btn-gold hover:btn-gold-hover disabled:opacity-60">
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {err && <p className="text-destructive mb-4">{err}</p>}

        {orders && orders.length === 0 && (
          <p className="text-muted-foreground">No orders found for that email.</p>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {orders.length} order{orders.length === 1 ? "" : "s"} for <span className="text-foreground">{email}</span>
            </p>
            {orders.map((o) => (
              <article key={o.id} className="card-luxe p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">{o.type === "partner" ? "Partnership" : "Merchandise"}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-1">{o.reference}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-xl font-bold text-gold-gradient">{fmt(Number(o.amount), o.currency)}</p>
                </div>

                {o.type === "partner" ? (
                  <p className="text-sm">
                    Tier: <span className="text-primary font-semibold">{o.tier_name ?? o.tier ?? "—"}</span>
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-t border-border mt-2">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3">Product</th>
                          <th className="py-2 pr-3">Size</th>
                          <th className="py-2 pr-3 text-right">Qty</th>
                          <th className="py-2 pr-3 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.items ?? []).map((it, idx) => (
                          <tr key={idx} className="border-t border-border/60">
                            <td className="py-2 pr-3">{it.name ?? it.id ?? "—"}</td>
                            <td className="py-2 pr-3">{it.size ?? "—"}</td>
                            <td className="py-2 pr-3 text-right">{it.qty ?? 1}</td>
                            <td className="py-2 pr-3 text-right">{it.price != null ? fmt(Number(it.price), o.currency) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
