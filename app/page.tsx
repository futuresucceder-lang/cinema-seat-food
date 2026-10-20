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

  /*
   * If somebody opens the website without a QR code,
   * don't silently pretend they are sitting at F12.
   */
  if (!screen || !seat) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#fff8f4",
          color: "#202124",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: "#ffffff",
            padding: "30px",
            borderRadius: "20px",
            boxShadow: "0 18px 50px rgba(67, 35, 22, 0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "55px",
              marginBottom: "15px",
            }}
          >
            🎬
          </div>

          <h1>Welcome to Seat Bite</h1>

          <p
            style={{
              color: "#756b66",
              lineHeight: 1.6,
            }}
          >
            Please scan the QR code placed at your
            cinema seat to order food.
          </p>
        </div>
      </main>
    );
  }

  /*
   * ORDER CONFIRMATION
   */
  if (orderPlaced) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#fff8f4",
          color: "#202124",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
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
              fontSize: "65px",
              marginBottom: "10px",
            }}
          >
            🎉
          </div>

          <h1>Order Confirmation</h1>

          <p
            style={{
              marginTop: "20px",
              color: "#756b66",
            }}
          >
            Your order has been received.
          </p>

          {/* SEAT INFORMATION */}
          <div
            style={{
              background: "#ffffff",
              padding: "20px",
              borderRadius: "15px",
              marginTop: "25px",
            }}
          >
            <p>
              <strong>🎬 Screen:</strong> {screen}
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

          {/* ORDER CODE */}
          <div
            style={{
              marginTop: "20px",
              background: "#ffffff",
              padding: "20px",
              borderRadius: "15px",
            }}
          >
            <p
              style={{
                color: "#756b66",
                marginBottom: "8px",
              }}
            >
              Your Order ID
            </p>

            <h2
              style={{
                margin: 0,
                color: "#f45135",
                wordBreak: "break-word",
              }}
            >
              {orderCode}
            </h2>
          </div>

          <p
            style={{
              marginTop: "20px",
              color: "#bbb",
            }}
          >
            Thank you for ordering! 🍿
          </p>

          {/* TRACK ORDER */}
          <button
            onClick={trackOrder}
            style={{
              width: "100%",
              marginTop: "25px",
              padding: "16px",
              borderRadius: "10px",
              border: "none",
              background: "#16803d",
              color: "white",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            📍 TRACK MY ORDER
          </button>

          {/* BACK TO MENU */}
          <button
            onClick={backToMenu}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #444",
              background: "#ffffff",
              color: "#202124",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            BACK TO MENU
          </button>
        </div>
      </main>
    );
  }

  /*
   * CUSTOMER FOOD MENU
   */
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff8f4",
        color: "#202124",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
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
          <div
            style={{
              fontSize: "48px",
            }}
          >
            🎬
          </div>

          <h1
            style={{
              fontSize: "32px",
              margin: "8px 0",
            }}
          >
            Seat Bite
          </h1>

          <p
            style={{
              color: "#756b66",
              margin: 0,
            }}
          >
            Order food directly from your seat
          </p>
        </div>

        {/* SEAT INFORMATION */}
        <div
          style={{
            background: "#ffffff",
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
                color: "#756b66",
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
              🎬 {screen}
            </strong>
          </div>

          <div
            style={{
              width: "1px",
              background: "#e7d8d0",
            }}
          />

          <div>
            <div
              style={{
                color: "#756b66",
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

        {/* CATEGORIES */}
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
              className={selectedCategory === category ? "seatbite-category-active" : ""}
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
                    ? "#f45135"
                    : "#fff0ea",
                color: "#202124",
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
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid #f0e5df",
                  boxShadow: "0 4px 16px rgba(67, 35, 22, 0.04)",
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
                        color: "#756b66",
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
                      background: "#f45135",
                      color: "#ffffff",
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
                      background: "#f7ebe5",
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
                        background: "#eadbd4",
                        color: "#202124",
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
                        background: "#f45135",
                        color: "#ffffff",
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
            background: "#ffffff",
            padding: "20px",
            borderRadius: "18px",
            border: "1px solid #f0e5df",
            boxShadow: "0 4px 16px rgba(67, 35, 22, 0.04)",
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
                color: "#756b66",
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

                  if (!item) {
                    return null;
                  }

                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        padding: "10px 0",
                        borderBottom:
                          "1px solid #f0e5df",
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
                  justifyContent: "space-between",
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

          {/* CHECKOUT */}
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
                  ? "#e7d8d0"
                  : "#f45135",
              color: "#202124",
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
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff8f4",
            color: "#202124",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <p>Preparing your cinema menu...</p>
        </main>
      }
    >
      <CustomerOrderPage />
    </Suspense>
  );
}