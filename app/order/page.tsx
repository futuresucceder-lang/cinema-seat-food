"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

const foodItems = [
  {
    id: 1,
    name: "Classic Popcorn",
    price: 180,
    emoji: "🍿",
  },
  {
    id: 2,
    name: "Cheese Nachos",
    price: 220,
    emoji: "🧀",
  },
  {
    id: 3,
    name: "Cold Drink",
    price: 120,
    emoji: "🥤",
  },
  {
    id: 4,
    name: "Veg Burger",
    price: 200,
    emoji: "🍔",
  },
];

function OrderPage() {
  const searchParams = useSearchParams();

  const screen = searchParams.get("screen") || "3";
  const seat = searchParams.get("seat") || "F12";

  const [cart, setCart] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState("");

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

  const total = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const item = foodItems.find(
      (food) => food.id === Number(id)
    );

    return sum + (item?.price || 0) * quantity;
  }, 0);

  async function handleCheckout() {
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
          quantity,
        };
      }
    );

    const { error } = await supabase
      .from("orders")
      .insert({
        order_code: newOrderCode,
        movie: null,
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
          error.message
      );

      setIsSubmitting(false);
      return;
    }

    setOrderCode(newOrderCode);
    setIsSubmitting(false);

    alert(
      "Order placed successfully!\n\nOrder ID: " +
        newOrderCode
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "30px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <div style={{ fontSize: "50px" }}>
            🎬
          </div>

          <h1>🍿 Cinema Food Ordering</h1>

          <p style={{ color: "#aaa" }}>
            Order food directly from your seat
          </p>
        </div>

        <div
          style={{
            background: "#222",
            padding: "20px",
            borderRadius: "15px",
            marginBottom: "25px",
            textAlign: "center",
          }}
        >
          <h2>Seat Information</h2>

          <p>
            <strong>Screen:</strong> {screen}
          </p>

          <p>
            <strong>Seat:</strong> {seat}
          </p>
        </div>

        <h2>🍿 Food & Drinks</h2>

        <p style={{ color: "#aaa" }}>
          Select your food and place your order.
        </p>

        <div style={{ marginTop: "20px" }}>
          {foodItems.map((item) => {
            const quantity = cart[item.id] || 0;

            return (
              <div
                key={item.id}
                style={{
                  background: "#222",
                  padding: "18px",
                  borderRadius: "15px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "35px",
                    }}
                  >
                    {item.emoji}
                  </div>

                  <strong>{item.name}</strong>

                  <div
                    style={{
                      color: "#aaa",
                      marginTop: "5px",
                    }}
                  >
                    ₹{item.price}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  {quantity > 0 && (
                    <>
                      <button
                        onClick={() =>
                          removeFromCart(item.id)
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "none",
                        }}
                      >
                        −
                      </button>

                      <strong>{quantity}</strong>
                    </>
                  )}

                  <button
                    onClick={() =>
                      addToCart(item.id)
                    }
                    style={{
                      background: "#e50914",
                      color: "white",
                      border: "none",
                      padding: "12px 18px",
                      borderRadius: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            background: "#e50914",
            padding: "20px",
            borderRadius: "15px",
            marginTop: "25px",
            textAlign: "center",
          }}
        >
          <h3>
            🛒 {itemCount} item(s)
          </h3>

          <div
            style={{
              fontSize: "25px",
              fontWeight: "bold",
            }}
          >
            ₹{total}
          </div>

          <button
            onClick={handleCheckout}
            disabled={isSubmitting}
            style={{
              marginTop: "15px",
              padding: "14px 30px",
              borderRadius: "10px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {isSubmitting
              ? "PLACING ORDER..."
              : "CHECKOUT"}
          </button>
        </div>

        {orderCode && (
          <div
            style={{
              marginTop: "25px",
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              textAlign: "center",
            }}
          >
            <p>Your Order ID</p>

            <h2
              style={{
                color: "#e50914",
              }}
            >
              {orderCode}
            </h2>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "40px",
            textAlign: "center",
          }}
        >
          Loading...
        </div>
      }
    >
      <OrderPage />
    </Suspense>
  );
}