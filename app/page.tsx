"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SeatBiteLanding from "@/app/components/SeatBiteLanding";

type Category = "All" | "Snacks" | "Drinks" | "Meals";
type SavedOrder = { order_code: string; status: string; screen: string; seat: string; created_at: string; delivery_option?: string | null; cinema_id?: string | null };
type ShowSchedule = { id: string; show_end_at: string };
type DeliveryOption = "NOW" | "INTERVAL";
type FoodItem = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: Exclude<Category, "All">;
  description: string | null;
  image_url: string | null;
};
const categories: Category[] = ["All", "Snacks", "Drinks", "Meals"];

function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const cinemaId = searchParams.get("cinema") || "";
  const screen = searchParams.get("screen") || "";
  const seat = searchParams.get("seat") || "";

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>("NOW");
  const [showSchedule, setShowSchedule] = useState<ShowSchedule | null>(null);
  const [scheduleChecked, setScheduleChecked] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      if (!cinemaId) {
        setFoodItems([]);
        setMenuLoading(false);
        return;
      }
      setMenuLoading(true);
      setMenuError("");
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("cinema_id", cinemaId)
        .eq("is_available", true)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Error loading this cinema's menu:", error);
        setMenuError("We couldn't load this cinema's menu. Please scan the seat QR code again or contact staff.");
        setFoodItems([]);
      } else {
        const mapped: FoodItem[] = (data || []).map((item: any) => {
          const rawCategory = String(item.category || "").toLowerCase();
          const category: Exclude<Category, "All"> =
            rawCategory === "drink" || rawCategory === "drinks" || rawCategory === "beverage" || rawCategory === "beverages"
              ? "Drinks"
              : rawCategory === "meal" || rawCategory === "meals" || rawCategory === "food"
              ? "Meals"
              : "Snacks";
          return {
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price) || 0,
            emoji: item.emoji || (category === "Drinks" ? "🥤" : category === "Meals" ? "🍔" : "🍿"),
            category,
            description: item.description || null,
            image_url: item.image_url || null,
          };
        });
        setFoodItems(mapped);
      }
      setMenuLoading(false);
    }
    loadMenu();
    return () => { cancelled = true; };
  }, [cinemaId, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function loadShowSchedule() {
      if (!cinemaId || !screen) { setShowSchedule(null); setScheduleChecked(true); return; }
      const { data, error } = await supabase.from("show_schedules").select("id,show_end_at")
        .eq("cinema_id", cinemaId).eq("screen", screen)
        .gt("show_end_at", new Date().toISOString()).order("show_end_at", { ascending: true }).limit(1).maybeSingle();
      if (cancelled) return;
      if (error) { console.error("Could not load show schedule:", error); setShowSchedule(null); }
      else setShowSchedule(data as ShowSchedule | null);
      setScheduleChecked(true);
    }
    loadShowSchedule();
    const clock = window.setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => { cancelled = true; window.clearInterval(clock); };
  }, [cinemaId, screen, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function loadSavedOrders() {
      if (!cinemaId) return;
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const stored = JSON.parse(localStorage.getItem("cinema_order_codes") || "[]");
        const codes = Array.isArray(stored)
          ? [...new Set(stored.filter((code): code is string => typeof code === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)))]
          : [];
        if (codes.length === 0) {
          if (!cancelled) setSavedOrders([]);
          return;
        }
        const response = await fetch("/api/customer/orders?codes=" + encodeURIComponent(codes.join(",")), { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          console.error("Could not load saved orders:", result.error);
          setOrdersError("We couldn't load your previous orders. Please try again.");
          return;
        }
        setSavedOrders((result.orders || []).filter((order: SavedOrder) => order.cinema_id === cinemaId) as SavedOrder[]);
      } catch (error) {
        console.warn("Could not read saved order codes:", error);
        if (!cancelled) setSavedOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    loadSavedOrders();
    return () => { cancelled = true; };
  }, [cinemaId, supabase]);

  function addToCart(id: string) {
    setCart((previous) => ({ ...previous, [id]: (previous[id] || 0) + 1 }));
  }
  function removeFromCart(id: string) {
    setCart((previous) => {
      const quantity = previous[id] || 0;
      if (quantity <= 1) {
        const updated = { ...previous };
        delete updated[id];
        return updated;
      }
      return { ...previous, [id]: quantity - 1 };
    });
  }

  const filteredFoodItems = selectedCategory === "All"
    ? foodItems
    : foodItems.filter((item) => item.category === selectedCategory);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const item = foodItems.find((food) => food.id === id);
    return sum + (item?.price || 0) * quantity;
  }, 0);

  const showEndMs = showSchedule ? new Date(showSchedule.show_end_at).getTime() : null;
  const orderCutoffMs = showEndMs === null ? null : showEndMs - 30 * 60 * 1000;
  const orderingClosed = orderCutoffMs !== null && currentTime >= orderCutoffMs;
  const cutoffLabel = orderCutoffMs === null ? "" : new Date(orderCutoffMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  async function handleCheckout() {
    if (orderingClosed) { alert("Online food ordering for this show closed 30 minutes before the show ends. Please contact cinema staff."); return; }
    if (!cinemaId || !screen || !seat) {
      alert("This QR code is missing the cinema, screen, or seat information. Please scan the QR code at your seat again.");
      return;
    }
    if (itemCount === 0) {
      alert("Please add at least one food item.");
      return;
    }
    setIsSubmitting(true);
    const requestedItems = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
    let newOrderCode = "";
    let placedOrder: any = null;
    try {
      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cinemaId, screen, seat, items: requestedItems, deliveryOption }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your order could not be submitted.");
      placedOrder = result.order;
      newOrderCode = placedOrder.order_code;
    } catch (error) {
      console.error("Order error:", error);
      alert(error instanceof Error ? error.message : "Your order could not be submitted. Please try again.");
      setIsSubmitting(false);
      return;
    }
    try {
      const previousCodes = JSON.parse(localStorage.getItem("cinema_order_codes") || "[]");
      localStorage.setItem("cinema_order_codes", JSON.stringify([...previousCodes, newOrderCode]));
    } catch (error) {
      console.warn("Could not save order code on this device:", error);
    }
    setSavedOrders((previous) => [{ order_code: newOrderCode, status: placedOrder.status || "NEW", screen: placedOrder.screen, seat: placedOrder.seat, created_at: placedOrder.created_at, delivery_option: placedOrder.delivery_option }, ...previous.filter((item) => item.order_code !== newOrderCode)]);
    setOrderCode(newOrderCode);
    setOrderPlaced(true);
    setIsSubmitting(false);
  }

  function trackOrder() {
    if (orderCode) router.push("/order-status?order=" + encodeURIComponent(orderCode));
  }
  function backToMenu() {
    setCart({});
    setOrderCode("");
    setOrderPlaced(false);
    setSelectedCategory("All");
  }

  if (!cinemaId || !screen || !seat) {
    return <SeatBiteLanding />;
  }

  if (orderPlaced) {
    return (
      <main className="seatbite-page">
        <div className="seatbite-shell seatbite-confirm-shell">
          <header className="seatbite-confirm-card">
            <div className="seatbite-success-icon">✓</div>
            <p className="seatbite-eyebrow">ORDER RECEIVED</p>
            <h1>You're all set!</h1>
            <p className="seatbite-muted">Sit back, relax, and let the snacks come to you.</p>
            <div className="seatbite-location-row">
              <div><span>SCREEN</span><strong>{screen}</strong></div>
              <div><span>YOUR SEAT</span><strong>{seat}</strong></div>
            </div>
            <div className="seatbite-order-code"><span>YOUR ORDER NUMBER</span><strong>{orderCode}</strong></div>
            <div className="seatbite-confirm-total"><span>Order total</span><strong>₹{total}</strong></div>
            <button className="seatbite-primary-button seatbite-full-button" onClick={trackOrder}>Track my order <span>→</span></button>
            <button className="seatbite-secondary-button seatbite-full-button" onClick={backToMenu}>Back to menu</button>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="seatbite-page">
      <div className="seatbite-shell">
        <div className="seatbite-topline">
          <div className="seatbite-wordmark"><img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="seatbite-official-logo" style={{display:"block",width:190,height:"auto",maxHeight:58,objectFit:"contain"}} /></div>
          <div className="seatbite-top-actions"><div className="seatbite-open-pill"><span></span> SERVING YOUR SCREEN</div><button type="button" className="seatbite-secondary-button seatbite-my-orders-button" onClick={() => setShowMyOrders((open) => !open)} aria-expanded={showMyOrders}>My Orders <span>↗</span></button></div>
        </div>
        <header className="seatbite-hero">
          <div className="seatbite-hero-copy">
            <p className="seatbite-eyebrow">YOUR SEAT. YOUR SNACKS.</p>
            <h1>Movie magic.<br /><span>Made tastier.</span></h1>
            <p>Order your favourites and choose delivery now or during the interval.</p>
            <div className="seatbite-hero-tags"><span>✦ Freshly prepared</span><span>✦ Delivered to your seat</span></div>
          </div>
          <div className="seatbite-hero-art" aria-hidden="true">
            <div className="seatbite-hero-glow"></div><div className="seatbite-popcorn-illustration">🍿</div>
            <span className="seatbite-art-spark spark-one">✦</span><span className="seatbite-art-spark spark-two">✧</span>
            <div className="seatbite-art-caption">THE PERFECT<br />MOVIE SIDEKICK</div>
          </div>
        </header>
        <section className="seatbite-seat-strip">
          <div className="seatbite-seat-icon">▣</div>
          <div className="seatbite-seat-copy"><span>ORDERING FOR</span><strong>Screen {screen} <i>·</i> Seat {seat}</strong></div>
          <span className="seatbite-seat-check">✓</span>
        </section>
        {showMyOrders && (
          <section className="seatbite-cart seatbite-my-orders-panel" aria-label="My orders">
            <div className="seatbite-cart-heading">
              <div className="seatbite-cart-icon">🧾</div>
              <div><h2>My orders</h2><p>Orders saved on this device for this cinema.</p></div>
              <button type="button" className="seatbite-my-orders-close" onClick={() => setShowMyOrders(false)} aria-label="Close my orders">×</button>
            </div>
            {ordersLoading ? <p className="seatbite-muted">Loading your orders…</p> :
              ordersError ? <p className="seatbite-muted" role="alert">{ordersError}</p> :
              savedOrders.length === 0 ? <p className="seatbite-muted">No saved orders found on this device yet. After placing an order, you can come back here anytime to track it.</p> :
              <div className="seatbite-my-orders-list">{savedOrders.map((savedOrder) => (
                <div className="seatbite-my-order-row" key={savedOrder.order_code}>
                  <div><strong>{savedOrder.order_code}</strong><p>Screen {savedOrder.screen} · Seat {savedOrder.seat}</p><span style={{display:"inline-block",margin:"4px 6px 4px 0",padding:"5px 9px",borderRadius:20,background:savedOrder.delivery_option==="INTERVAL"?"#fff0d9":"#e4f6e9",color:savedOrder.delivery_option==="INTERVAL"?"#8a4b00":"#176534",fontSize:12,fontWeight:800}}>{savedOrder.delivery_option==="INTERVAL"?"⏱ Deliver During Interval":"⚡ Deliver Now"}</span><span className={"seatbite-status-badge status-" + (savedOrder.status || "NEW").toLowerCase()}>{(savedOrder.status || "NEW").replace("_", " ")}</span></div>
                  <button type="button" className="seatbite-primary-button" onClick={() => router.push("/order-status?order=" + encodeURIComponent(savedOrder.order_code))}>Track order <span>→</span></button>
                </div>
              ))}</div>
            }
          </section>
        )}
        <section className="seatbite-seat-strip" aria-label="Delivery timing" style={{display:"block",marginTop:14}}>
          <div style={{fontWeight:800,marginBottom:10,color:"#202124"}}>When would you like your order?</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:13,border:"1px solid "+(deliveryOption==="NOW"?"#f45135":"#e8d8d1"),borderRadius:12,background:deliveryOption==="NOW"?"#fff0e9":"#fff",cursor:"pointer",color:"#202124"}}>
              <input type="radio" name="deliveryOption" checked={deliveryOption==="NOW"} onChange={()=>setDeliveryOption("NOW")} style={{marginTop:4,accentColor:"#f45135"}} />
              <span><strong>Deliver Now</strong><br/><small>Bring it to my seat as soon as possible.</small></span>
            </label>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:13,border:"1px solid "+(deliveryOption==="INTERVAL"?"#f45135":"#e8d8d1"),borderRadius:12,background:deliveryOption==="INTERVAL"?"#fff0e9":"#fff",cursor:"pointer",color:"#202124"}}>
              <input type="radio" name="deliveryOption" checked={deliveryOption==="INTERVAL"} onChange={()=>setDeliveryOption("INTERVAL")} style={{marginTop:4,accentColor:"#f45135"}} />
              <span><strong>Deliver During Interval</strong><br/><small>Prepare it for the movie break.</small></span>
            </label>
          </div>
          {showSchedule && !orderingClosed && <p style={{margin:"10px 0 0",fontSize:13,color:"#59473f"}}>Ordering closes at {cutoffLabel} (30 minutes before this show ends).</p>}
          {orderingClosed && <p role="alert" style={{margin:"10px 0 0",fontWeight:800,color:"#b42318"}}>Ordering is closed for this show. Please contact cinema staff.</p>}
          {!scheduleChecked && <p style={{margin:"8px 0 0",fontSize:12,color:"#756b66"}}>Checking show ordering time…</p>}
        </section>
        <section className="seatbite-menu-heading">
          <div><p className="seatbite-eyebrow">THE GOOD STUFF</p><h2>What are you craving?</h2><p>Little treats for your big-screen moments.</p></div>
          <span className="seatbite-menu-count">{menuLoading ? "Loading menu…" : filteredFoodItems.length + " delicious picks"}</span>
        </section>
        <nav className="seatbite-categories" aria-label="Food categories">
          {categories.map((category) => (
            <button key={category} className={selectedCategory === category ? "seatbite-category-active" : ""} onClick={() => setSelectedCategory(category)}>
              <span>{category === "All" ? "✦" : category === "Snacks" ? "🍿" : category === "Drinks" ? "🥤" : "🍔"}</span>{category}
            </button>
          ))}
        </nav>
        {menuError && <div role="alert" className="seatbite-status-message">{menuError}</div>}
        <section className="seatbite-food-grid">
          {menuLoading ? (
            <p className="seatbite-muted">Loading this cinema’s menu…</p>
          ) : menuError ? null : filteredFoodItems.length === 0 ? (
            <p className="seatbite-muted">{foodItems.length === 0 ? "This cinema has no available food items yet." : "No items in this category."}</p>
          ) : filteredFoodItems.map((item) => {
            const quantity = cart[item.id] || 0;
            return (
              <article className="seatbite-product-card" key={item.id}>
                <div className="seatbite-product-image-wrap">
                  {item.image_url ? <img className="seatbite-product-image" src={item.image_url} alt={item.name} /> : <div className="seatbite-product-image seatbite-product-placeholder">{item.emoji}</div>}
                  <span className="seatbite-product-emoji">{item.emoji}</span>
                </div>
                <div className="seatbite-product-content">
                  <span className="seatbite-product-category">{item.category}</span>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                  <div className="seatbite-product-bottom"><strong>₹{item.price}</strong>
                    {quantity === 0 ? <button className="seatbite-add-button" onClick={() => addToCart(item.id)}><span>＋</span> Add</button> :
                      <div className="seatbite-quantity"><button aria-label={"Remove one " + item.name} onClick={() => removeFromCart(item.id)}>−</button><strong>{quantity}</strong><button aria-label={"Add one " + item.name} onClick={() => addToCart(item.id)}>＋</button></div>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        <section className="seatbite-cart">
          <div className="seatbite-cart-heading"><div className="seatbite-cart-icon">🛍️</div><div><h2>Your snack box</h2><p>{itemCount === 0 ? "Your movie treats will show up here." : itemCount + " item" + (itemCount !== 1 ? "s" : "") + " selected for your show"}</p></div><span className="seatbite-cart-count">{itemCount}</span></div>
          {itemCount > 0 && <div className="seatbite-cart-lines">{Object.entries(cart).map(([id, quantity]) => { const item = foodItems.find((food) => food.id === id); if (!item) return null; return <div className="seatbite-cart-line" key={id}><span>{item.emoji} {item.name} <small>× {quantity}</small></span><strong>₹{item.price * quantity}</strong></div>; })}</div>}
          <div className="seatbite-cart-total"><span>Order total</span><strong>₹{total}</strong></div>
          <button className="seatbite-primary-button seatbite-full-button" onClick={handleCheckout} disabled={isSubmitting || menuLoading || !!menuError || itemCount === 0 || orderingClosed}>{orderingClosed ? "Ordering closed for this show" : isSubmitting ? "Placing your order…" : <>Continue to order <span>→</span></>}</button>
          <p className="seatbite-secure-note">♡ Made for your movie moment</p>
        </section>
        <footer className="seatbite-footer"><span>🍿 seatbite</span><span>Good food. Great movies.</span></footer>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="seatbite-page seatbite-loading"><div className="seatbite-loader">🍿</div><p>Preparing your movie menu…</p></main>}><CustomerOrderPage /></Suspense>;
}
