"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Category = "All" | "Snacks" | "Drinks" | "Meals";

type FoodItem = {
  id: number;
  name: string;
  price: number;
  emoji: string;
  category: Exclude<Category, "All">;
};

const foodItems: FoodItem[] = [
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

const categories: Category[] = [
  "All",
  "Snacks",
  "Drinks",
  "Meals",
];

export default function Home() {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [selectedCategory, setSelectedCategory] =
    useState<Category>("All");

  const [currentScreen, setCurrentScreen] = useState("3");
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

  function removeFromCart(id: number) {
    setCart((prev) => {
      const currentQuantity = prev[id] || 0;

      if (currentQuantity <= 1) {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      }

      return {
        ...prev,
        [id]: currentQuantity - 1,
      };
    });
  }

  const filteredFoodItems = useMemo(() => {
    if (selectedCategory === "All") {
      return foodItems;
    }

    return foodItems.filter(
      (item) => item.category === selectedCategory
    );
  }, [selectedCategory]);

  const total = Object.entries(cart).reduce(
    (sum, [id, quantity]) => {
      const item = foodItems.find(
        (food) => food.id === Number(id)
      );

      return sum + (item?.price || 0) * quantity;
    },
    0
  );

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
        "Order could not be submitted.\n\n" +
          error.message
      );

      setIsSubmitting(false);
      return;
    }

    setOrderCode(newOrderCode);
    setCurrentScreen("4");
    setIsSubmitting(false);
  }

  function backToMenu() {
    setCart({});
    setOrderCode("");
    setCurrentScreen("3");
    setSelectedCategory("All");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {currentScreen === "3" && (
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "25px",
            }}
          >
            <div style={{ fontSize: "48px" }}>
              🎬
            </div>

            <h1
              style={{
                fontSize: "32px",
                margin: "8px 0",
              }}
            >
              Cinema Food
            </h1>

            <p
              style={{
                color: "#aaa",
                margin: 0,
              }}
            >
              Order food directly from your seat
            </p>
          </div>

          {/* SEAT INFORMATION */}
          <div
            style={{
              background: "#222",
              padding: "18px",
              borderRadius: "15px",
              marginBottom: "25px",
              display: "flex",
              justifyContent: "space-around",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  color: "#999",
                  fontSize: "13px",
                }}
              >
                SCREEN
              </div>

              <strong
                style={{
                  fontSize: "20px",
                }}
              >
                🎬 {cinemaScreen}
              </strong>
            </div>

            <div
              style={{
                width: "1px",
                background: "#444",
              }}
            />

            <div>
              <div
                style={{
                  color: "#999",
                  fontSize: "13px",
                }}
              >
                SEAT
              </div>

              <strong
                style={{
                  fontSize: "20px",
                }}
              >
                💺 {seat}
              </strong>
            </div>
          </div>

          {/* CATEGORY BUTTONS */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "10px",
              marginBottom: "20px",
            }}
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  setSelectedCategory(category)
                }
                style={{
                  flex: "0 0 auto",
                  padding: "10px 16px",
                  borderRadius: "20px",
                  border: "none",
                  background:
                    selectedCategory === category
                      ? "#e50914"
                      : "#292929",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {category === "All" && "🍽️ "}
                {category === "Snacks" && "🍿 "}
                {category === "Drinks" && "🥤 "}
                {category === "Meals" && "🍔 "}
                {category}
              </button>
            ))}
          </div>

          <h2
            style={{
              marginBottom: "15px",
            }}
          >
            🍿 Food & Drinks
          </h2>

          {/* FOOD ITEMS */}
          <div>
            {filteredFoodItems.map((item) => {
              const quantity = cart[item.id] || 0;

              return (
                <div
                  key={item.id}
                  style={{
                    background: "#222",
                    padding: "16px",
                    borderRadius: "15px",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "15px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "38px",
                      }}
                    >
                      {item.emoji}
                    </div>

                    <div>
                      <strong
                        style={{
                          fontSize: "17px",
                        }}
                      >
                        {item.name}
                      </strong>

                      <div
                        style={{
                          color: "#aaa",
                          marginTop: "5px",
                        }}
                      >
                        ₹{item.price}
                      </div>
                    </div>
                  </div>

                  {quantity === 0 ? (
                    <button
                      onClick={() =>
                        addToCart(item.id)
                      }
                      style={{
                        background: "#e50914",
                        color: "white",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      + Add
                    </button>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "#333",
                        padding: "5px",
                        borderRadius: "10px",
                      }}
                    >
                      <button
                        onClick={() =>
                          removeFromCart(item.id)
                        }
                        style={{
                          width: "34px",
                          height: "34px",
                          border: "none",
                          borderRadius: "8px",
                          background: "#555",
                          color: "white",
                          fontSize: "20px",
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>

                      <strong
                        style={{
                          minWidth: "20px",
                          textAlign: "center",
                        }}
                      >
                        {quantity}
                      </strong>

                      <button
                        onClick={() =>
                          addToCart(item.id)
                        }
                        style={{
                          width: "34px",
                          height: "34px",
                          border: "none",
                          borderRadius: "8px",
                          background: "#e50914",
                          color: "white",
                          fontSize: "20px",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CART */}
          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              marginTop: "25px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                }}
              >
                🛒 Your Cart
              </h3>

              <strong>
                {itemCount} item
                {itemCount !== 1 ? "s" : ""}
              </strong>
            </div>

            {itemCount === 0 ? (
              <p
                style={{
                  color: "#888",
                  textAlign: "center",
                  margin: "20px 0 5px",
                }}
              >
                Your cart is empty
              </p>
            ) : (
              <div
                style={{
                  marginTop: "15px",
                }}
              >
                {Object.entries(cart).map(
                  ([id, quantity]) => {
                    const item = foodItems.find(
                      (food) =>
                        food.id === Number(id)
                    );

                    if (!item) return null;

                    return (
                      <div
                        key={id}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          padding: "10px 0",
                          borderBottom:
                            "1px solid #333",
                        }}
                      >
                        <span>
                          {item.emoji} {item.name} ×{" "}
                          {quantity}
                        </span>

                        <strong>
                          ₹{item.price * quantity}
                        </strong>
                      </div>
                    );
                  }
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    marginTop: "15px",
                    fontSize: "22px",
                    fontWeight: "bold",
                  }}
                >
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={
                isSubmitting || itemCount === 0
              }
              style={{
                width: "100%",
                marginTop: "18px",
                padding: "15px",
                borderRadius: "10px",
                border: "none",
                background:
                  itemCount === 0
                    ? "#444"
                    : "#e50914",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor:
                  isSubmitting || itemCount === 0
                    ? "not-allowed"
                    : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting
                ? "PLACING ORDER..."
                : "CHECKOUT • ₹" + total}
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION */}
      {currentScreen === "4" && (
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            minHeight: "90vh",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "60px",
              marginBottom: "10px",
            }}
          >
            🎉
          </div>

          <h1>Order Confirmation</h1>

          <p
            style={{
              marginTop: "20px",
              color: "#bbb",
            }}
          >
            Your order has been received.
          </p>

          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              marginTop: "25px",
            }}
          >
            <p>
              <strong>🎬 Screen:</strong>{" "}
              {cinemaScreen}
            </p>

            <p>
              <strong>💺 Seat:</strong> {seat}
            </p>

            <h2
              style={{
                marginTop: "25px",
              }}
            >
              Total: ₹{total}
            </h2>
          </div>

          <div
            style={{
              marginTop: "20px",
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
                margin: 0,
                color: "#e50914",
                wordBreak: "break-word",
              }}
            >
              {orderCode}
            </h2>
          </div>

          <p
            style={{
              marginTop: "20px",
            }}
          >
            Thank you for ordering! 🍿
          </p>

         <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "30px",
  }}
>
  <button
    onClick={() => {
      window.location.href =
        `/order-status?order=${encodeURIComponent(orderCode)}`;
    }}
    style={{
      width: "100%",
      padding: "15px",
      borderRadius: "10px",
      border: "none",
      fontWeight: "bold",
      cursor: "pointer",
      background: "#16a34a",
      color: "white",
      fontSize: "16px",
    }}
  >
    📍 TRACK MY ORDER
  </button>

  <button
    onClick={backToMenu}
    style={{
      width: "100%",
      padding: "14px",
      borderRadius: "10px",
      border: "none",
      fontWeight: "bold",
      cursor: "pointer",
      background: "#333",
      color: "white",
    }}
  >
    🍿 BACK TO MENU
  </button>
</div>
        </div>
      )}
    </main>
  );
}