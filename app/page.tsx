"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = "All" | "Snacks" | "Drinks" | "Meals";
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
        .select("id, cinema_id, name, description, price, image_url, category, emoji, is_available")
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

  async function handleCheckout() {
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
    return (
      <main className="seatbite-page seatbite-gate">
        <section className="seatbite-gate-card">
          <div className="seatbite-gate-icon">🎬</div>
          <div className="seatbite-brand-small"><span>🍿</span> SEAT BITE</div>
          <p className="seatbite-eyebrow">CINEMA, MADE DELICIOUS</p>
          <h1>Your movie night,<br />with better bites.</h1>
          <p className="seatbite-muted">Please scan the QR code at your cinema seat to load the correct cinema menu.</p>
        </section>
      </main>
    );
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
          <div className="seatbite-wordmark"><span className="seatbite-wordmark-icon">🍿</span><span>seat<span>bite</span></span></div>
          <div className="seatbite-open-pill"><span></span> SERVING YOUR SCREEN</div>
        </div>
        <header className="seatbite-hero">
          <div className="seatbite-hero-copy">
            <p className="seatbite-eyebrow">YOUR SEAT. YOUR SNACKS.</p>
            <h1>Movie magic.<br /><span>Made tastier.</span></h1>
            <p>Cravings don’t wait for intermission. Order your favourites and we’ll bring them to you.</p>
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
          <button className="seatbite-primary-button seatbite-full-button" onClick={handleCheckout} disabled={isSubmitting || menuLoading || !!menuError || itemCount === 0}>{isSubmitting ? "Placing your order…" : <>Continue to order <span>→</span></>}</button>
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
