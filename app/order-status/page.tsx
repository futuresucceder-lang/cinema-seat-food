"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

const supabase = createClient();
const formatINR = (amount: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(amount);

type FoodItem = { id?: string; name: string; price?: number; emoji?: string; quantity?: number };
type Order = { order_code: string; movie: string | null; cinema_id?: string | null; screen: string; seat: string; food_items: FoodItem[]; total: number; status: string; created_at: string; delivery_option?: string | null };

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("order");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderCode) { setError("Order ID is missing."); setLoading(false); return; }
    async function loadOrder() {
      const { data, error } = await supabase.from("orders").select("*").eq("order_code", orderCode).single();
      if (error) { console.error(error); setError("Order not found."); } else { setOrder(data); }
      setLoading(false);
    }
    loadOrder();
    const channel = supabase.channel(`order-status-${orderCode}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "orders", filter: `order_code=eq.${orderCode}`,
    }, (payload) => setOrder(payload.new as Order)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderCode]);

  if (loading) return <main className="seatbite-page seatbite-status-page"><div className="seatbite-status-card"><div className="seatbite-loader">🍿</div><p>Getting your order update…</p></div></main>;
  if (error || !order) return <main className="seatbite-page seatbite-status-page"><div className="seatbite-status-card"><div className="seatbite-status-symbol">!</div><h1>We couldn't find that order</h1><p className="seatbite-muted">{error}</p><a href="/" className="seatbite-primary-button seatbite-full-button">Back to Seat Bite <span>→</span></a></div></main>;

  const status = (order.status || "NEW").toUpperCase();
  const stages = [
    { label: "Received", emoji: "📋", active: ["NEW", "PREPARING", "READY", "COMPLETED"].includes(status) },
    { label: "Preparing", emoji: "👨‍🍳", active: ["PREPARING", "READY", "COMPLETED"].includes(status) },
    { label: "Ready", emoji: "🔔", active: ["READY", "COMPLETED"].includes(status) },
    { label: "Delivered", emoji: "🎉", active: status === "COMPLETED" },
  ];
  const statusCopy: Record<string, string> = { NEW: "Your order has been received", PREPARING: "The kitchen is preparing your order", READY: "Your snacks are ready to come to you!", COMPLETED: "Enjoy your movie — order completed" };

  return (
    <main className="seatbite-page seatbite-status-page">
      <div className="seatbite-status-shell">
        <header className="seatbite-status-topline"><a href="/" className="seatbite-wordmark"><span className="seatbite-wordmark-icon">🍿</span><span>seat<span>bite</span></span></a><span className="seatbite-open-pill"><span></span> LIVE ORDER UPDATES</span></header>
        <section className="seatbite-status-hero"><p className="seatbite-eyebrow">YOUR MOVIE NIGHT, IN MOTION</p><h1>Track your <span>order.</span></h1><p>We'll keep you posted while your favourites make their way to you.</p></section>
        <section className="seatbite-status-card seatbite-order-summary">
          <div className="seatbite-status-card-heading"><div><p className="seatbite-eyebrow">ORDER NUMBER</p><h2>{order.order_code}</h2></div><span className={"seatbite-status-badge status-" + status.toLowerCase()}>{status.replace("_", " ")}</span></div>
          <div className="seatbite-location-row"><div><span>SCREEN</span><strong>{order.screen}</strong></div><div><span>YOUR SEAT</span><strong>{order.seat}</strong></div></div><div style={{marginTop:16,padding:"12px 14px",borderRadius:12,background:order.delivery_option==="INTERVAL"?"#fff0d9":"#e4f6e9",color:order.delivery_option==="INTERVAL"?"#8a4b00":"#176534",fontWeight:800}}>{order.delivery_option==="INTERVAL"?"⏱ Deliver During Interval":"⚡ Deliver Now"}</div>
        </section>
        <section className="seatbite-status-card">
          <p className="seatbite-eyebrow">THE LATEST</p><h2 className="seatbite-section-title">Your snack journey</h2>
          <div className="seatbite-status-timeline">{stages.map((stage, index) => <div className={"seatbite-timeline-step " + (stage.active ? "is-active" : "")} key={stage.label}><div className="seatbite-timeline-icon">{stage.active ? "✓" : stage.emoji}</div><span>{stage.label}</span>{index < stages.length - 1 && <div className={"seatbite-timeline-line " + (stages[index + 1].active ? "is-active" : "")}></div>}</div>)}</div>
          <div className="seatbite-status-message"><span className="seatbite-status-message-icon">{status === "COMPLETED" ? "🎉" : status === "READY" ? "🔔" : status === "PREPARING" ? "👨‍🍳" : "🍿"}</span><div><strong>{statusCopy[status] || "Your order status has been updated"}</strong><p>Keep enjoying the show. This page updates when the team changes your order status.</p></div></div>
        </section>
        <section className="seatbite-status-card"><p className="seatbite-eyebrow">IN YOUR SNACK BOX</p><h2 className="seatbite-section-title">Your order</h2><div className="seatbite-status-food-list">{order.food_items?.map((item, index) => <div className="seatbite-status-food" key={item.id ?? index}><span className="seatbite-status-food-icon">{item.emoji ?? "🍿"}</span><span className="seatbite-status-food-name">{item.name}<small>Quantity: {item.quantity ?? 1}</small></span><strong>{formatINR((item.price ?? 0) * (item.quantity ?? 1))}</strong></div>)}</div><div className="seatbite-status-total"><span>Total</span><strong>{formatINR(order.total)}</strong></div></section>
        <a href={order.cinema_id ? `/?cinema=${encodeURIComponent(order.cinema_id)}&screen=${encodeURIComponent(order.screen)}&seat=${encodeURIComponent(order.seat)}` : "/"} className="seatbite-secondary-button seatbite-status-back">← Back to menu</a>
        <footer className="seatbite-footer"><span>🍿 seatbite</span><span>Good food. Great movies.</span></footer>
      </div>
    </main>
  );
}

export default function OrderStatusPage() {
  return <Suspense fallback={<main className="seatbite-page seatbite-loading"><div className="seatbite-loader">🍿</div><p>Loading your order…</p></main>}><OrderStatusContent /></Suspense>;
}
