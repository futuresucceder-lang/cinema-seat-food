"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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

export default function OrderPage() {
  const router = useRouter();

  const [cart, setCart] = useState<Record<number, number>>({});
  const [selectedCategory, setSelectedCategory] =
    useState<Category>("All");

  const [cinemaScreen, setCinemaScreen] = useState("");
  const [seat, setSeat] = useState("");

  const [orderCode, setOrderCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [page, setPage] = useState<"menu" | "confirmation">(
    "menu"
  );

  const [invalidQr, setInvalidQr] = useState(false);

  /*
   * Read screen and seat directly from the QR URL.
   *
   * Examples:
   *
   * /order?screen=3&seat=F12
   * /order?screen=3&seat=F15
   * /order?screen=5&seat=F20
   *
   * There is NO Screen 3 / F12 fallback.
   */
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const screenNumber = params.get("screen");
    const seatNumber = params.get("seat");

    if (!screenNumber || !seatNumber) {
      setInvalidQr(true);
      return;
    }

    setCinemaScreen(screenNumber);
    setSeat(seatNumber);
  }, []);

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
    if (!cinemaScreen || !seat) {
      alert(
        "Invalid seat information. Please scan the QR code again."
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

        // These come from THIS QR code.
        screen: cinemaScreen,
        seat: seat,

        food_items: orderedFoodItems,
        total: total,
        status: "NEW",
      });

    if (error) {
      console.error("Order error:", error);

      alert(
        "Order could not be submitted.\n\nPlease try again."
      );

      setIsSubmitting(false);
      return;
    }

    setOrderCode(newOrderCode);
    setPage("confirmation");
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
    setPage("menu");
    setSelectedCategory("All");
  }

  /*
   * Invalid QR
   */
  if (invalidQr) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#111",
          color: "white",
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
            background: "#222",
            padding: "30px",
            borderRadius: "16px",
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

          <h1>Invalid Seat QR Code</h1>

          <p
            style={{
              color: "#aaa",
              lineHeight: 1.6,
            }}
          >
            Please scan the QR code placed at your
            cinema seat to order food.
          </p>

          <button
            onClick={() => router.push("/")}
            style={{
              marginTop: "20px",
              padding: "12px 22px",
              borderRadius: "10px",
              border: "none",
              background: "#e50914",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            GO TO HOME
          </button>
        </div>
      </main>
    );
  }

  /*
   * ORDER CONFIRMATION
   */
  if (page === "confirmation") {
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

          {/* SEAT INFORMATION */}
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

          {/* ORDER CODE */}
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
              background: "#16a34a",
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
              background: "#222",
              color: "white",
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
   * CUSTOMER MENU
   */
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
    </main>
  );
}