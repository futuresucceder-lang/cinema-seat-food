"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const foodItems = [
  {
    id: 1,
    name: "Classic Popcorn",
    price: 180,
    emoji: "🍿",
    category: "Snacks",
  },
  {
    id: 2,
    name: "Cheese Nachos",
    price: 220,
    emoji: "🧀",
    category: "Snacks",
  },
  {
    id: 3,
    name: "Cold Drink",
    price: 120,
    emoji: "🥤",
    category: "Drinks",
  },
  {
    id: 4,
    name: "Veg Burger",
    price: 200,
    emoji: "🍔",
    category: "Meals",
  },
];

const categories = ["All", "Snacks", "Drinks", "Meals"];

function CustomerOrderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  /*
   * IMPORTANT:
   * Do NOT use Screen 3 / F12 as defaults.
   *
   * The QR code should open a URL such as:
   *
   * /?screen=3&seat=F12
   * /?screen=3&seat=F15
   * /?screen=5&seat=F20
   *
   * Every seat therefore gets its own order location.
   */

  const screen = searchParams.get("screen");
  const seat = searchParams.get("seat");

  const [cart, setCart] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [orderPlaced, setOrderPlaced] = useState(false);

  function addToCart(id: number) {
    setCart((previous) => ({
      ...previous,
      [id]: (previous[id] || 0) + 1,
    }));
  }

  function removeFromCart(id: number) {
    setCart((previous) => {
      const currentQuantity = previous[id] || 0;

      if (currentQuantity <= 1) {
        const updated = { ...previous };
        delete updated[id];
        return updated;
      }

      return {
        ...previous,
        [id]: currentQuantity - 1,
      };
    });
  }

  const itemCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );

  const total = Object.entries(cart).reduce(
    (sum, [id, quantity]) => {
      const item = foodItems.find(
        (food) => food.id === Number(id)
      );

      return sum + (item?.price || 0) * quantity;
    },
    0
  );

  const filteredFoodItems =
    selectedCategory === "All"
      ? foodItems
      : foodItems.filter(
          (item) => item.category === selectedCategory
        );

  async function handleCheckout() {
    if (!screen || !seat) {
      alert(
        "This QR code does not contain a valid screen and seat."
      );
      return;
    }

    if (itemCount === 0) {
      alert("Please add at least one food item.");
      return;
    }

    setIsSubmitting(true);

    const newOrderCode =
      "CINEMA-" +
      crypto.randomUUID().slice(0, 8).toUpperCase();

    const orderedFoodItems = Object.entries(cart).map(
      ([id, quantity]) => {
        const item = foodItems.find(
          (food) => food.id === Number(id)
        );

        return {
          id: item?.id,
          name: item?.name,
          price: item?.price,
          emoji: item?.emoji,
          category: item?.category,
          quantity,
        };
      }
    );

    const { error } = await supabase
      .from("orders")
      .insert({
        order_code: newOrderCode,
        movie: null,

        // These values come directly from the QR code.
        screen: screen,
        seat: seat,

        food_items: orderedFoodItems,
        total: total,
        status: "NEW",
      });

    if (error) {
      console.error("Order error:", error);

      alert(
        "Order could not be submitted.\n\n" +
          "Please try again."
      );

      setIsSubmitting(false);
      return;
    }

    setOrderCode(newOrderCode);
    setOrderPlaced(true);
    setIsSubmitting(false);
  }

  function trackOrder() {
    if (!orderCode) {
      return;
    }

    router.push(
      `/order-status?order=${encodeURIComponent(orderCode)}`
    );
  }

  function backToMenu() {
    setCart({});
    setOrderCode("");
    setOrderPlaced(false);
    setSelectedCategory("All");
  }

  if (!screen || !seat) {
    return (
      <main className="seatbite-page seatbite-gate">
        <section className="seatbite-gate-card">
          <div className="seatbite-gate-icon">🎬</div>
          <div className="seatbite-brand-small"><span>🍿</span> SEAT BITE</div>
          <p className="seatbite-eyebrow">CINEMA, MADE DELICIOUS</p>
          <h1>Your movie night,<br/>with better bites.</h1>
          <p className="seatbite-muted">Scan the QR code at your cinema seat to explore the menu and order straight to your seat.</p>
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
            <div className="seatbite-confirm-total"><span>Total paid at counter</span><strong>₹{total}</strong></div>
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
            <h1>Movie magic.<br/><span>Made tastier.</span></h1>
            <p>Cravings don’t wait for intermission. Order your favourites and we’ll bring them to you.</p>
            <div className="seatbite-hero-tags"><span>✦ Freshly prepared</span><span>✦ Delivered to your seat</span></div>
          </div>
          <div className="seatbite-hero-art" aria-hidden="true">
            <div className="seatbite-hero-glow"></div>
            <div className="seatbite-popcorn-illustration">🍿</div>
            <span className="seatbite-art-spark spark-one">✦</span><span className="seatbite-art-spark spark-two">✧</span>
            <div className="seatbite-art-caption">THE PERFECT<br/>MOVIE SIDEKICK</div>
          </div>
        </header>

        <section className="seatbite-seat-strip">
          <div className="seatbite-seat-icon">▣</div>
          <div className="seatbite-seat-copy"><span>ORDERING FOR</span><strong>Screen {screen} <i>·</i> Seat {seat}</strong></div>
          <span className="seatbite-seat-check">✓</span>
        </section>

        <section className="seatbite-menu-heading">
          <div><p className="seatbite-eyebrow">THE GOOD STUFF</p><h2>What are you craving?</h2><p>Little treats for your big-screen moments.</p></div>
          <span className="seatbite-menu-count">{filteredFoodItems.length} delicious picks</span>
        </section>

        <nav className="seatbite-categories" aria-label="Food categories">
          {categories.map((category) => (
            <button key={category} className={selectedCategory === category ? "seatbite-category-active" : ""} onClick={() => setSelectedCategory(category)}>
              <span>{category === "All" ? "✦" : category === "Snacks" ? "🍿" : category === "Drinks" ? "🥤" : "🍔"}</span>{category}
            </button>
          ))}
        </nav>

        <section className="seatbite-food-grid">
          {filteredFoodItems.map((item) => {
            const quantity = cart[item.id] || 0;
            const photo = item.id === 1
              ? "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=500&q=85"
              : item.id === 2
              ? "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=500&q=85"
              : item.id === 3
              ? "https://images.unsplash.com/photo-1513558161293-cdab2da7f9e8?auto=format&fit=crop&w=500&q=85"
              : "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=85";
            const description = item.id === 1 ? "A classic, buttery cinema favourite" : item.id === 2 ? "Crispy nachos, cheesy goodness" : item.id === 3 ? "Chilled and refreshingly fizzy" : "A hearty bite between scenes";
            return (
              <article className="seatbite-product-card" key={item.id}>
                <div className="seatbite-product-image-wrap"><img className="seatbite-product-image" src={photo} alt={item.name} /><span className="seatbite-product-emoji">{item.emoji}</span></div>
                <div className="seatbite-product-content">
                  <span className="seatbite-product-category">{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{description}</p>
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
          {itemCount > 0 && <div className="seatbite-cart-lines">{Object.entries(cart).map(([id, quantity]) => { const item = foodItems.find((food) => food.id === Number(id)); if (!item) return null; return <div className="seatbite-cart-line" key={id}><span>{item.emoji} {item.name} <small>× {quantity}</small></span><strong>₹{item.price * quantity}</strong></div>; })}</div>}
          <div className="seatbite-cart-total"><span>Order total</span><strong>₹{total}</strong></div>
          <button className="seatbite-primary-button seatbite-full-button" onClick={handleCheckout} disabled={isSubmitting || itemCount === 0}>{isSubmitting ? "Placing your order…" : <>Continue to order <span>→</span></>}</button>
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
