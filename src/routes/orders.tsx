import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listAllOrders, type OrderRow } from "@/lib/orders.functions";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders Admin — Simba wa Yuda" }] }),
  component: OrdersPage,
});

const fmt = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function OrdersPage() {
  const list = useServerFn(listAllOrders);
  const [session, setSession] = useState<null | { email: string }>(null);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [filter, setFilter] = useState("");
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSession(data.user ? { email: data.user.email ?? "" } : null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { email: s.user.email ?? "" } : null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = async (emailFilter = "") => {
    setErr("");
    setLoading(true);
    try {
      const res = await list({ data: { email: emailFilter } });
      setOrders(res.orders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load orders");
      setOrders(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) setAuthErr(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOrders(null);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={signIn} className="card-luxe p-8 w-full max-w-md space-y-4">
          <div>
            <p className="uppercase tracking-[0.3em] text-xs text-primary mb-2">Admin</p>
            <h1 className="text-3xl mb-2">Orders <span className="text-gold-gradient">Sign In</span></h1>
            <p className="text-sm text-muted-foreground">Use your admin email &amp; password to view orders.</p>
          </div>
          <input
            type="email" required placeholder="Admin email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
          <input
            type="password" required placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
          {authErr && <p className="text-destructive text-sm">{authErr}</p>}
          <button type="submit" disabled={authLoading} className="btn-gold hover:btn-gold-hover w-full disabled:opacity-60">
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            <a href="/" className="hover:text-foreground">← Back to shop</a>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3">
            <img src="/blogo.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-display text-lg text-gold-gradient">Simba wa Yuda</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{session.email}</span>
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground">Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <p className="uppercase tracking-[0.3em] text-xs text-primary mb-3">Admin</p>
        <h1 className="text-4xl sm:text-5xl mb-8">All <span className="text-gold-gradient">Orders</span></h1>

        <div className="card-luxe p-4 grid sm:grid-cols-[1fr_auto_auto] gap-3 mb-8">
          <input
            type="text" placeholder="Filter by customer email (optional)"
            value={filter} onChange={(e) => setFilter(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
          <button onClick={() => load(filter)} disabled={loading} className="btn-gold hover:btn-gold-hover disabled:opacity-60">
            {loading ? "Loading…" : "Search"}
          </button>
          <button onClick={() => { setFilter(""); load(""); }} className="border border-border rounded-md px-4 py-2 hover:border-primary">
            Reset
          </button>
        </div>

        {err && <p className="text-destructive mb-4">{err}</p>}

        {orders && orders.length === 0 && (
          <p className="text-muted-foreground">No orders found.</p>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
            {orders.map((o) => (
              <article key={o.id} className="card-luxe p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary">
                      {o.type === "partner" ? "Partnership" : "Merchandise"}
                    </p>
                    <p className="text-sm mt-1">{o.customer_name ?? "—"} · <span className="text-muted-foreground">{o.email}</span></p>
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
                          <th className="py-2 pr-3">Color</th>
                          <th className="py-2 pr-3">Size</th>
                          <th className="py-2 pr-3 text-right">Qty</th>
                          <th className="py-2 pr-3 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.items ?? []).map((it, idx) => (
                          <tr key={idx} className="border-t border-border/60">
                            <td className="py-2 pr-3">{it.name ?? it.id ?? "—"}</td>
                            <td className="py-2 pr-3">{it.color ?? "—"}</td>
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
