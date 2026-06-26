import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import bannerAsset from "@/assets/banner.asset.json";
import blogoAsset from "@/assets/blogo.asset.json";
import tshirtBlack from "@/assets/tshirt-black.jpg";
import tshirtWhite from "@/assets/tshirt-white.jpg";
import hoodieBlack from "@/assets/hoodie-black.jpg";
import capBlack from "@/assets/cap-black.jpg";
import mugBlack from "@/assets/mug-black.jpg";
import toteBlack from "@/assets/tote-black.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Simba wa Yuda — Live Recording Event" },
      { name: "description", content: "Shop official Simba wa Yuda merchandise and partner with us to make the live recording happen." },
      { property: "og:title", content: "Simba wa Yuda — Live Recording Event" },
      { property: "og:description", content: "Official merchandise store and partnership portal for the Simba wa Yuda live recording." },
      { property: "og:image", content: bannerAsset.url },
      { property: "twitter:image", content: bannerAsset.url },
    ],
  }),
  component: Index,
});

/* ============================================================
 * CONFIG — Replace these placeholders for production deployment
 * ============================================================ */
// Get your Paystack public key from https://dashboard.paystack.com/#/settings/developers
const PAYSTACK_PUBLIC_KEY = "pk_live_70e633f27be9cd5fc9b335fd6cf63a19430f77a7";
// Server endpoint that verifies Paystack webhook signatures using PAYSTACK_SECRET_KEY.
// Configure this URL in your Paystack Dashboard → Settings → API Keys & Webhooks.
// Replace the host with your custom domain once published.
const WEBHOOK_URL = "https://simbawayuda.lovable.app/api/public/paystack-webhook";

// Partner access password (change this; ideally move to a server-validated flow)
const PARTNER_PASSWORD = "lionofjudah2025";
// Currency for Paystack — KES, USD, GHS, ZAR, NGN supported
const CURRENCY = "KES";

/* ============================================================
 * Product catalog
 * ============================================================ */
type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // in major units (KES)
  image: string;
  sizes?: string[];
};

const PRODUCTS: Product[] = [
  { id: "tee-black", name: "Lion Tee — Black", description: "Premium cotton tee with gold lion crest.", price: 1500, image: tshirtBlack, sizes: ["S","M","L","XL"] },
  { id: "tee-white", name: "Lion Tee — White", description: "Soft cotton tee with classic crest print.", price: 1500, image: tshirtWhite, sizes: ["S","M","L","XL"] },
  { id: "hoodie",    name: "Simba Hoodie",      description: "Heavyweight fleece hoodie, embroidered crest.", price: 3500, image: hoodieBlack, sizes: ["S","M","L","XL"] },
  { id: "cap",       name: "Lion Cap",          description: "Structured cap with gold embroidery.", price: 1200, image: capBlack },
  { id: "mug",       name: "Roar Mug",          description: "11oz ceramic mug with gold crest.", price: 800,  image: mugBlack },
  { id: "tote",      name: "Lion Tote",         description: "Heavy canvas tote — carry the roar.", price: 1000, image: toteBlack },
];

const TIERS = [
  { id: "bronze",   name: "Bronze Partner",   price: 25000,  perks: ["Logo on event banner", "Social media mention", "2 event passes"] },
  { id: "silver",   name: "Silver Partner",   price: 75000,  perks: ["Premium booth space", "Logo on stage backdrop", "5 event passes", "Speaking slot (3 min)"] },
  { id: "gold",     name: "Gold Partner",     price: 150000, perks: ["Prime booth + product showcase", "Co-branded merchandise", "10 event passes", "Speaking slot (7 min)", "Logo on recorded video credits"] },
  { id: "platinum", name: "Platinum Partner", price: 300000, perks: ["Title sponsor recognition", "Full co-branding on merch line", "20 event passes", "Keynote slot (15 min)", "Premium digital + video credits", "Dedicated PR feature"] },
];

/* ============================================================
 * Paystack helper
 * ============================================================ */
declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

function payWithPaystack(opts: {
  email: string;
  amount: number; // in major units
  reference: string;
  metadata: Record<string, unknown>;
  onSuccess: (ref: string) => void;
  onClose: () => void;
}) {
  if (!window.PaystackPop) {
    alert("Payment library is still loading. Please try again in a moment.");
    return;
  }
  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: opts.email,
    amount: Math.round(opts.amount * 100), // Paystack uses subunits
    currency: CURRENCY,
    ref: opts.reference,
    metadata: opts.metadata,
    callback: (response: { reference: string }) => opts.onSuccess(response.reference),
    onClose: opts.onClose,
  });
  handler.openIframe();
}

/* ============================================================
 * Cart state (localStorage-backed)
 * ============================================================ */
type CartItem = { id: string; name: string; price: number; image: string; size?: string; qty: number; key: string };

function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("swy_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("swy_cart", JSON.stringify(items));
  }, [items]);

  const add = (p: Product, size?: string) => {
    const key = `${p.id}${size ? `-${size}` : ""}`;
    setItems(prev => {
      const ex = prev.find(i => i.key === key);
      if (ex) return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, key, name: p.name, price: p.price, image: p.image, size, qty: 1 }];
    });
  };
  const setQty = (key: string, qty: number) => setItems(prev => qty <= 0
    ? prev.filter(i => i.key !== key)
    : prev.map(i => i.key === key ? { ...i, qty } : i));
  const remove = (key: string) => setItems(prev => prev.filter(i => i.key !== key));
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, add, setQty, remove, clear, total, count };
}

const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);

/* ============================================================
 * Page
 * ============================================================ */
function Index() {
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerUnlocked, setPartnerUnlocked] = useState(false);
  const [confirmation, setConfirmation] = useState<null | { ref: string; type: "merch" | "partner"; amount: number; email: string }>(null);

  useEffect(() => {
    if (sessionStorage.getItem("swy_partner_ok") === "1") setPartnerUnlocked(true);
  }, []);

  return (
    <div className="min-h-screen">
      <Header cartCount={cart.count} onCart={() => setCartOpen(true)} onPartner={() => setPartnerOpen(true)} partnerUnlocked={partnerUnlocked} />
      <Hero />
      <EventInfo />
      <Store products={PRODUCTS} onAdd={(p, s) => { cart.add(p, s); setCartOpen(true); }} />
      {partnerUnlocked && (
        <PartnersSection onPay={(tier, email) => {
          payWithPaystack({
            email,
            amount: tier.price,
            reference: `swy-partner-${tier.id}-${Date.now()}`,
            metadata: { type: "partnership", tier: tier.id, tier_name: tier.name },
            onSuccess: (ref) => setConfirmation({ ref, type: "partner", amount: tier.price, email }),
            onClose: () => {},
          });
        }} />
      )}
      <Footer />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} onCheckout={(email) => {
        payWithPaystack({
          email,
          amount: cart.total,
          reference: `swy-merch-${Date.now()}`,
          metadata: { type: "merchandise", items: cart.items.map(i => ({ id: i.id, size: i.size, qty: i.qty })) },
          onSuccess: (ref) => { const amt = cart.total; cart.clear(); setCartOpen(false); setConfirmation({ ref, type: "merch", amount: amt, email }); },
          onClose: () => {},
        });
      }} />

      {partnerOpen && !partnerUnlocked && (
        <PartnerGate
          onClose={() => setPartnerOpen(false)}
          onUnlock={() => { sessionStorage.setItem("swy_partner_ok", "1"); setPartnerUnlocked(true); setPartnerOpen(false); setTimeout(() => document.getElementById("partners")?.scrollIntoView({ behavior: "smooth" }), 100); }}
        />
      )}

      {confirmation && <ConfirmationModal data={confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/* ============================================================
 * UI sections
 * ============================================================ */
function Header({ cartCount, onCart, onPartner, partnerUnlocked }: { cartCount: number; onCart: () => void; onPartner: () => void; partnerUnlocked: boolean }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 h-16">
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <img src={blogoAsset.url} alt="Simba wa Yuda" className="h-10 w-10 shrink-0 rounded-full object-cover" width={40} height={40} />
          <span className="truncate font-display text-lg sm:text-xl text-gold-gradient">Simba wa Yuda</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-4">
          <a href="#event" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">Event</a>
          <a href="#shop" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">Shop</a>
          <button onClick={onPartner} className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">
            {partnerUnlocked ? "Partners ✓" : "Partner Login"}
          </button>
          <button onClick={onCart} className="btn-outline-gold relative px-3 py-2 text-sm">
            Cart
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 grid place-items-center">{cartCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={bannerAsset.url} alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-44 text-center">
        <p className="uppercase tracking-[0.3em] text-xs sm:text-sm text-primary mb-4">Live Recording • Revelation 5:5</p>
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold leading-[0.95]">
          <span className="text-gold-gradient">Simba wa Yuda</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
          Help us raise <span className="text-foreground font-semibold">$4,500</span> to bring the live recording to life.
          Wear the vision. Partner the movement.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a href="#shop" className="btn-gold hover:btn-gold-hover">Shop Merchandise</a>
          <a href="#event" className="btn-outline-gold hover:bg-primary hover:text-primary-foreground">Learn More</a>
        </div>
      </div>
    </section>
  );
}

function EventInfo() {
  return (
    <section id="event" className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="uppercase tracking-[0.3em] text-xs text-primary mb-3">The Event</p>
          <h2 className="text-4xl sm:text-5xl">A One-Day Gathering. <span className="text-gold-gradient">A Lifetime Sound.</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card-luxe p-8">
            <h3 className="text-2xl mb-3 text-primary">The Vision</h3>
            <p className="text-muted-foreground">A live worship recording bringing together 1,500–2,000 souls at Pipeline, Embakasi. Every shirt sold, every partnership signed, brings us closer to capturing this moment for generations.</p>
          </div>
          <div className="card-luxe p-8">
            <h3 className="text-2xl mb-3 text-primary">How To Help</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>→ Buy merch — wear the message, fund the recording.</li>
              <li>→ Become a partner — gain visibility, fuel the vision.</li>
              <li>→ Share with your circle — every roar counts.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Store({ products, onAdd }: { products: Product[]; onAdd: (p: Product, size?: string) => void }) {
  return (
    <section id="shop" className="py-20 sm:py-28 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="uppercase tracking-[0.3em] text-xs text-primary mb-3">Official Merchandise</p>
          <h2 className="text-4xl sm:text-5xl">Wear the <span className="text-gold-gradient">Roar</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product, size?: string) => void }) {
  const [size, setSize] = useState<string | undefined>(product.sizes?.[1]);
  return (
    <article className="card-luxe overflow-hidden flex flex-col">
      <div className="aspect-square bg-muted overflow-hidden">
        <img src={product.image} alt={product.name} loading="lazy" width={1024} height={1024} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <span className="text-primary font-semibold whitespace-nowrap">{fmt(product.price)}</span>
        </div>
        <p className="text-sm text-muted-foreground">{product.description}</p>
        {product.sizes && (
          <div className="flex flex-wrap gap-2">
            {product.sizes.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`min-w-10 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${size === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => onAdd(product, size)} className="btn-gold hover:btn-gold-hover mt-auto w-full">Add to Cart</button>
      </div>
    </article>
  );
}

function CartDrawer({ open, onClose, cart, onCheckout }: { open: boolean; onClose: () => void; cart: ReturnType<typeof useCart>; onCheckout: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const valid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-50 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
      <aside className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-card border-l border-border flex flex-col transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl">Your Cart</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.items.length === 0 && <p className="text-muted-foreground text-center py-12">Your cart is empty.</p>}
          {cart.items.map(i => (
            <div key={i.key} className="flex gap-3 card-luxe p-3">
              <img src={i.image} alt="" className="w-16 h-16 rounded-md object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className="truncate font-medium">{i.name}</p>
                  <button onClick={() => cart.remove(i.key)} className="text-muted-foreground hover:text-destructive text-sm">Remove</button>
                </div>
                {i.size && <p className="text-xs text-muted-foreground">Size: {i.size}</p>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => cart.setQty(i.key, i.qty - 1)} className="w-7 h-7 rounded border border-border hover:border-primary">−</button>
                    <span className="w-6 text-center">{i.qty}</span>
                    <button onClick={() => cart.setQty(i.key, i.qty + 1)} className="w-7 h-7 rounded border border-border hover:border-primary">+</button>
                  </div>
                  <span className="text-primary font-semibold">{fmt(i.price * i.qty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cart.items.length > 0 && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex justify-between text-lg">
              <span>Total</span>
              <span className="text-gold-gradient font-bold">{fmt(cart.total)}</span>
            </div>
            <input type="email" placeholder="Email for receipt" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }}
              className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary" />
            {err && <p className="text-destructive text-sm">{err}</p>}
            <button onClick={() => valid ? onCheckout(email) : setErr("Enter a valid email address.")} className="btn-gold hover:btn-gold-hover w-full">
              Checkout with Paystack
            </button>
            <p className="text-xs text-muted-foreground text-center">Secure payment • Visa, Mastercard, Mobile Money</p>
          </div>
        )}
      </aside>
    </>
  );
}

function PartnerGate({ onClose, onUnlock }: { onClose: () => void; onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-luxe max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl mb-2 text-gold-gradient">Partner Access</h2>
        <p className="text-sm text-muted-foreground mb-6">This area is reserved for confirmed partners. Enter the access password shared in your partnership invitation.</p>
        <form onSubmit={e => { e.preventDefault(); if (pw === PARTNER_PASSWORD) onUnlock(); else setErr("Incorrect password."); }}>
          <input type="password" autoFocus value={pw} onChange={e => { setPw(e.target.value); setErr(""); }}
            placeholder="Access password"
            className="w-full bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary" />
          {err && <p className="text-destructive text-sm mt-2">{err}</p>}
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose} className="btn-outline-gold flex-1">Cancel</button>
            <button type="submit" className="btn-gold hover:btn-gold-hover flex-1">Unlock</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PartnersSection({ onPay }: { onPay: (tier: typeof TIERS[number], email: string) => void }) {
  const [selected, setSelected] = useState<typeof TIERS[number] | null>(null);
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    if (!selected) return setErr("Choose a tier.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email.");
    if (!org.trim()) return setErr("Enter your organization or full name.");
    if (!agree) return setErr("You must accept the partnership agreement.");
    setErr("");
    onPay(selected, email);
  };

  return (
    <section id="partners" className="py-20 sm:py-28 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="uppercase tracking-[0.3em] text-xs text-primary mb-3">Partner Portal</p>
          <h2 className="text-4xl sm:text-5xl">Stand With The <span className="text-gold-gradient">Vision</span></h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Reach 1,500–2,000 engaged attendees. Choose a partnership level that fits your goals — every tier includes co-branding and visibility opportunities.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {TIERS.map(t => (
            <button key={t.id} onClick={() => setSelected(t)}
              className={`card-luxe p-6 text-left transition ${selected?.id === t.id ? "ring-2 ring-primary" : "hover:-translate-y-1"}`}>
              <h3 className="text-xl text-primary">{t.name}</h3>
              <p className="text-2xl font-bold mt-2 text-gold-gradient">{fmt(t.price)}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {t.perks.map(p => <li key={p}>✓ {p}</li>)}
              </ul>
            </button>
          ))}
        </div>

        <div className="card-luxe p-6 sm:p-8 max-w-2xl mx-auto">
          <h3 className="text-xl mb-4">Confirm Your Partnership</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input type="text" placeholder="Organization / Full Name" value={org} onChange={e => setOrg(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary" />
            <input type="email" placeholder="Email for receipt" value={email} onChange={e => setEmail(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary" />
          </div>
          <label className="flex items-start gap-2 mt-4 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 accent-[oklch(0.78_0.14_80)]" />
            <span>I have read and agree to the partnership terms: deliverables will be provided per tier, payment is non-refundable, and brand assets will be supplied within 7 days of confirmation.</span>
          </label>
          {err && <p className="text-destructive text-sm mt-3">{err}</p>}
          <button onClick={submit} className="btn-gold hover:btn-gold-hover w-full mt-5">
            {selected ? `Pay ${fmt(selected.price)} with Paystack` : "Select a tier above"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmationModal({ data, onClose }: { data: { ref: string; type: "merch" | "partner"; amount: number; email: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="card-luxe max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-3">🦁</div>
        <h2 className="text-3xl text-gold-gradient mb-2">Thank You!</h2>
        <p className="text-muted-foreground">
          Your {data.type === "merch" ? "order" : "partnership"} of <span className="text-foreground font-semibold">{fmt(data.amount)}</span> has been confirmed.
        </p>
        <p className="text-sm text-muted-foreground mt-4">A receipt has been sent to <span className="text-foreground">{data.email}</span>.</p>
        <p className="text-xs text-muted-foreground mt-2">Reference: <code className="text-primary">{data.ref}</code></p>
        <button onClick={onClose} className="btn-gold hover:btn-gold-hover w-full mt-6">Continue</button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10 mt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src={blogoAsset.url} alt="" className="h-8 w-8 shrink-0 rounded-full" />
          <p className="truncate text-sm text-muted-foreground">© {new Date().getFullYear()} Simba wa Yuda. Revelation 5:5</p>
        </div>
        <p className="text-xs text-muted-foreground">Pipeline, Embakasi • Nairobi</p>
      </div>
    </footer>
  );
}
