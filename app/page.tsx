"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

export default function Home() {
  const [cart, setCart] = useState<Record<number, number>>({});

  // Current page of the app
  const [currentScreen, setCurrentScreen] = useState("3");

  // Actual cinema screen number
  const [cinemaScreen, setCinemaScreen] = useState("3");

  const [seat, setSeat] = useState("F12");

  const [orderCode, setOrderCode] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const screenNumber = params.get("screen");
    const seatNumber = params.get("seat");

    if (screenNumber) {
      setCinemaScreen(screenNumber);
    }

    if (seatNumber) {
      setSeat(seatNumber);
    }
  }, []);

  function addToCart(id: number) {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  }

  const total = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const item = foodItems.find((food) => food.id === Number(id));

    return sum + (item?.price || 0) * quantity;
  }, 0);

  const itemCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );

  async function handleCheckout() {
    if (itemCount === 0) {
      alert("Please add at least one food item.");
      return;
    }

    setIsSubmitting(true);

    // Create a unique order code
    const newOrderCode =
      "CINEMA-" + crypto.randomUUID().slice(0, 8).toUpperCase();

    // Convert cart into readable food-order data
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

    const { error } = await supabase.from("orders").insert({
      order_code: newOrderCode,
      movie: null,
      screen: cinemaScreen,
      seat: seat,
      food_items: orderedFoodItems,
      total: total,
      status: "NEW",
    });

    if (error) {
      console.error("Order error:", error);

      alert(
        "Order could not be submitted.\n\n" + error.message
      );

      setIsSubmitting(false);
      return;
    }

    // Save the order code so we can show it later
    setOrderCode(newOrderCode);

    // Move to confirmation screen
    setCurrentScreen("4");

    setIsSubmitting(false);
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
      {currentScreen === "3" && (
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
            <div style={{ fontSize: "50px" }}>🎬</div>

            <h1
              style={{
                fontSize: "32px",
                margin: "10px 0",
              }}
            >
              Cinema Food
            </h1>

            <p style={{ color: "#aaa" }}>
              Order food directly from your seat
            </p>
          </div>

          <div
            style={{
              background: "#222",
              padding: "18px",
              borderRadius: "15px",
              marginBottom: "25px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "5px" }}>
              <strong>
                Screen {cinemaScreen}
              </strong>
            </p>

            <p
              style={{
                margin: "5px",
                color: "#aaa",
              }}
            >
              Seat {seat}
            </p>
          </div>

          <h2>🍿 Food & Drinks</h2>

          <div>
            {foodItems.map((item) => (
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
                  <div style={{ fontSize: "30px" }}>
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

                <button
                  onClick={() => addToCart(item.id)}
                  style={{
                    background: "#e50914",
                    color: "white",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  + Add
                </button>
              </div>
            ))}
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
            <h3 style={{ margin: "0 0 8px 0" }}>
              🛒 {itemCount} item(s)
            </h3>

            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              ₹{total}
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              style={{
                marginTop: "12px",
                padding: "14px 30px",
                borderRadius: "10px",
                border: "none",
                fontWeight: "bold",
                cursor: isSubmitting
                  ? "not-allowed"
                  : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting
                ? "PLACING ORDER..."
                : "CHECKOUT"}
            </button>
          </div>
        </div>
      )}

      {currentScreen === "4" && (
  <div
    style={{
      maxWidth: "600px",
      margin: "0 auto",
      minHeight: "100vh",
      padding: "40px 20px",
      background: "#111",
      color: "white",
      textAlign: "center",
    }}
  >
    <h1>🎉 Order Confirmation</h1>

    <p style={{ marginTop: "20px" }}>
      Your order has been received.
    </p>

    <p>
      <strong>Screen:</strong> {cinemaScreen}
    </p>

    <p>
      <strong>Seat:</strong> {seat}
    </p>

    <h2 style={{ marginTop: "30px" }}>
      Total: ₹{total}
    </h2>

    <div
      style={{
        marginTop: "25px",
        background: "#222",
        padding: "20px",
        borderRadius: "15px",
      }}
    >
      <p
        style={{
          color: "#aaa",
          marginBottom: "8px",
        }}
      >
        Your Order ID
      </p>

      <h2
        style={{
          margin: "0",
          color: "#e50914",
        }}
      >
        {orderCode}
      </h2>
    </div>

    <p style={{ marginTop: "20px" }}>
      Thank you for ordering!
    </p>

    <button
      onClick={() => setCurrentScreen("3")}
      style={{
        marginTop: "30px",
        padding: "14px 30px",
        borderRadius: "10px",
        border: "none",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      BACK TO MENU
    </button>
  </div>
)}
    </main>
  );
}