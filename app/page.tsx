"use client";

// Production redeploy trigger: keep the latest customer menu homepage active.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SeatBiteLanding from "@/app/components/SeatBiteLanding";

type Category = "All" | "Burgers" | "Pizzas" | "Snacks" | "Drinks" | "Combo Deals";
type SavedOrder = { order_code: string; status: string; screen: string; seat: string; created_at: string; delivery_option?: string | null };
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
const categories: Category[] = ["Burgers", "Pizzas", "Snacks", "Drinks", "Combo Deals"];
const formatINR = (amount: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(amount);

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
          const rawName = String(item.name || "").toLowerCase();
          const category: Exclude<Category, "All"> =
            rawName.includes("burger") || rawCategory.includes("burger") ? "Burgers"
              : rawName.includes("pizza") || rawCategory.includes("pizza") ? "Pizzas"
              : rawCategory.includes("drink") || rawCategory.includes("beverage") ? "Drinks"
              : rawCategory.includes("combo") || rawName.includes("combo") ? "Combo Deals"
              : "Snacks";
          return {
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price) || 0,
            emoji: item.emoji || (category === "Drinks" ? "🥤" : category === "Burgers" ? "🍔" : "🍿"),
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
          ? [...new Set(stored.filter((code): code is string => typeof code === "string" && code.length > 0))]
          : [];
        if (codes.length === 0) {
          if (!cancelled) setSavedOrders([]);
          return;
        }
        const { data, error } = await supabase
          .from("orders")
          .select("order_code,status,screen,seat,created_at,delivery_option")
          .eq("cinema_id", cinemaId)
          .in("order_code", codes)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (error) {
          console.error("Could not load saved orders:", error);
          setOrdersError("We couldn't load your previous orders. Please try again.");
          return;
        }
        setSavedOrders((data || []) as SavedOrder[]);
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
    const newOrderCode = "CINEMA-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const orderedFoodItems = Object.entries(cart).flatMap(([id, quantity]) => {
      const item = foodItems.find((food) => food.id === id);
      return item ? [{
        id: item.id,
        name: item.name,
        price: item.price,
        emoji: item.emoji,
        category: item.category,
        quantity,
      }] : [];
    });

    const { error } = await supabase.from("orders").insert({
      order_code: newOrderCode,
      movie: null,
      cinema_id: cinemaId,
      screen,
      seat,
      food_items: orderedFoodItems,
      total,
      status: "NEW",
      delivery_option: deliveryOption,
    });
    if (error) {
      console.error("Order error:", error);
      alert("Your order could not be submitted. Please try again.");
      setIsSubmitting(false);
      return;
    }
    try {
      const previousCodes = JSON.parse(localStorage.getItem("cinema_order_codes") || "[]");
      localStorage.setItem("cinema_order_codes", JSON.stringify([...previousCodes, newOrderCode]));
    } catch (error) {
      console.warn("Could not save order code on this device:", error);
    }
    setSavedOrders((previous) => [{ order_code: newOrderCode, status: "NEW", screen, seat, created_at: new Date().toISOString(), delivery_option: deliveryOption }, ...previous.filter((item) => item.order_code !== newOrderCode)]);
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
            <div className="seatbite-confirm-total"><span>Order total</span><strong>{formatINR(total)}</strong></div>
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
          <img className="seatbite-customer-logo" src="/seatbite-logo.webp.jpg" alt="SeatBite" />
          <div className="seatbite-top-actions">
            <button type="button" className="seatbite-primary-button seatbite-my-orders-button" onClick={() => router.push(`/my-orders?cinema=${encodeURIComponent(cinemaId)}&screen=${encodeURIComponent(screen)}&seat=${encodeURIComponent(seat)}`)} aria-label={"My Order, " + itemCount + " items"}>
              <span aria-hidden="true">🛒</span> My Order <span className="seatbite-cart-badge">{itemCount}</span>
            </button>
          </div>
        </div>
        <header className="seatbite-hero">
          <div className="seatbite-hero-copy">
            <p className="seatbite-eyebrow">SIT BACK • ORDER • ENJOY</p>
            <h1>Good Food<br /><span>Better Movie!</span></h1>
            <p>Sit Back • Order • Enjoy</p>
          </div>
          <div className="seatbite-hero-art" aria-hidden="true">
            <img className="seatbite-hero-food-photo" src="/seatbite-cinema-hero.svg" alt="" />
          </div>
        </header>
        <section className="seatbite-seat-strip">
          <div className="seatbite-seat-icon">🎬</div>
          <div className="seatbite-seat-copy"><span>SCREEN</span><strong>{screen}</strong></div>
          <span className="seatbite-seat-divider" />
          <div className="seatbite-seat-icon">💺</div>
          <div className="seatbite-seat-copy"><span>SEAT</span><strong>{seat}</strong></div>
          
        </section>
        {showMyOrders && (
          <div className="seatbite-cart-overlay" role="presentation" onClick={() => setShowMyOrders(false)}>
            <section className="seatbite-cart-drawer" role="dialog" aria-modal="true" aria-label="My Order" onClick={(event) => event.stopPropagation()}>
              <div className="seatbite-cart-heading">
                <div className="seatbite-cart-icon">🛒</div>
                <div><h2>My Order</h2><p>{itemCount} item{itemCount === 1 ? "" : "s"} in your snack box</p></div>
                <button type="button" className="seatbite-my-orders-close" onClick={() => setShowMyOrders(false)} aria-label="Close cart">×</button>
              </div>
              {itemCount === 0 ? <div className="seatbite-cart-empty"><span>🍿</span><strong>Your cart is waiting</strong><p>Add your favourite snacks to get started.</p></div> :
                <div className="seatbite-drawer-lines">{Object.entries(cart).map(([id, quantity]) => {
                  const item = foodItems.find((food) => food.id === id);
                  if (!item) return null;
                  return <div className="seatbite-drawer-line" key={id}>
                    {item.image_url ? <img src={item.image_url} alt="" /> : <span className="seatbite-drawer-emoji">{item.emoji}</span>}
                    <div className="seatbite-drawer-item"><strong>{item.name}</strong><span>{formatINR(item.price)} each</span><div className="seatbite-quantity"><button aria-label={"Remove one " + item.name} onClick={() => removeFromCart(id)}>−</button><strong>{quantity}</strong><button aria-label={"Add one " + item.name} onClick={() => addToCart(id)}>＋</button></div></div>
                    <strong className="seatbite-drawer-price">{formatINR(item.price * quantity)}</strong>
                    <button type="button" className="seatbite-remove-line" onClick={() => setCart((previous) => { const next = {...previous}; delete next[id]; return next; })} aria-label={"Remove " + item.name}>×</button>
                  </div>;
                })}</div>}
              <div className="seatbite-drawer-total"><span>Subtotal</span><strong>{formatINR(total)}</strong></div>
              <div className="seatbite-delivery-choice">
                <h3>Delivery timing</h3>
                <label className={deliveryOption === "NOW" ? "seatbite-delivery-option active" : "seatbite-delivery-option"}>
                  <input type="radio" name="deliveryOption" checked={deliveryOption==="NOW"} onChange={()=>setDeliveryOption("NOW")} />
                  <span><strong>Deliver Now</strong><small>Bring it to my seat as soon as possible.</small></span>
                </label>
                <label className={deliveryOption === "INTERVAL" ? "seatbite-delivery-option active" : "seatbite-delivery-option"}>
                  <input type="radio" name="deliveryOption" checked={deliveryOption==="INTERVAL"} onChange={()=>setDeliveryOption("INTERVAL")} />
                  <span><strong>Deliver During Interval</strong><small>Prepare it for the movie break.</small></span>
                </label>
                {showSchedule && !orderingClosed && <p>Ordering closes at {cutoffLabel}, 30 minutes before the show ends.</p>}
                {orderingClosed && <p role="alert" className="seatbite-ordering-closed">Ordering is closed for this show. Please contact cinema staff.</p>}
                {!scheduleChecked && <p>Checking show ordering time…</p>}
              </div>
              <p className="seatbite-drawer-tax-note">No additional taxes are configured.</p>
              <button className="seatbite-primary-button seatbite-full-button" onClick={() => { setShowMyOrders(false); handleCheckout(); }} disabled={isSubmitting || menuLoading || !!menuError || itemCount === 0 || orderingClosed}>{orderingClosed ? "Ordering closed for this show" : isSubmitting ? "Placing your order…" : <>Checkout · {formatINR(total)} <span>→</span></>}</button>
              <div className="seatbite-drawer-saved-orders">
                <h3>Track previous orders</h3>
                {ordersLoading ? <p>Loading your orders…</p> : ordersError ? <p>{ordersError}</p> : savedOrders.length === 0 ? <p>Your placed orders will appear here.</p> :
                  savedOrders.slice(0,3).map((savedOrder) => <div key={savedOrder.order_code}><span>{savedOrder.order_code}</span><button type="button" onClick={() => router.push("/order-status?order=" + encodeURIComponent(savedOrder.order_code))}>Track order →</button></div>)}
              </div>
            </section>
          </div>
        )}

        <section className="seatbite-menu-heading">
          <div><p className="seatbite-eyebrow">OUR MENU</p><h2>Popular dishes</h2><p>Pick your favourites and enjoy them at your seat.</p></div>
          
        </section>
        <nav className="seatbite-categories" aria-label="Food categories">
          {categories.map((category) => (
            <button key={category} className={selectedCategory === category || (selectedCategory === "All" && category === "Burgers") ? "seatbite-category-active" : ""} onClick={() => setSelectedCategory(category)}>
              <span>{category === "Burgers" ? "🍔" : category === "Pizzas" ? "🍕" : category === "Snacks" ? "🍿" : category === "Drinks" ? "🥤" : "⭐"}</span>{category}
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
                  <h3>{item.name}</h3>
                  <div className="seatbite-product-bottom"><strong>{formatINR(item.price)}</strong>
                    <div className="seatbite-quantity"><button aria-label={"Remove one " + item.name} onClick={() => removeFromCart(item.id)} disabled={quantity === 0}>−</button><strong>{quantity}</strong><button aria-label={"Add one " + item.name} onClick={() => addToCart(item.id)}>＋</button></div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        <div className="seatbite-checkout-spacer" aria-hidden="true" />
        <div className="seatbite-sticky-checkout">
          <div className="seatbite-sticky-item">
            {(() => { const first = Object.entries(cart).find(([, quantity]) => quantity > 0); const item = first ? foodItems.find((food) => food.id === first[0]) : null; return item?.image_url ? <img src={item.image_url} alt="" /> : <span className="seatbite-sticky-emoji">{item?.emoji || "🍿"}</span>; })()}
            <span>{itemCount} {itemCount === 1 ? "item" : "items"} selected</span>
          </div>
          <div className="seatbite-sticky-total"><span>Total Amount</span><strong>{formatINR(total)}</strong></div>
          <button type="button" onClick={() => setShowMyOrders(true)} disabled={itemCount === 0 || isSubmitting}>Checkout <span>→</span></button>
        </div>
        <footer className="seatbite-footer"><span className="seatbite-footer-icon">🎞</span><span>Enjoy the Movie with <strong>SEAT BITE</strong></span><span className="seatbite-footer-heart">♥</span></footer>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="seatbite-page seatbite-loading"><div className="seatbite-loader">🍿</div><p>Preparing your movie menu…</p></main>}><CustomerOrderPage /></Suspense>;
}
