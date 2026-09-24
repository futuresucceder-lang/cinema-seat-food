"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FoodItem = {
  id: number;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
};

type Order = {
  id: number;
  order_code: string;
  movie: string | null;
  screen: string | null;
  seat: string | null;
  food_items: FoodItem[];
  total: number | null;
  status: string | null;
  created_at: string;
};

export default function FoodCourtPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .neq("status", "COMPLETED")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading orders:", error);
    return;
  }

  setOrders((data || []) as Order[]);
  setLoading(false);
}

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("food-court-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("Error updating order:", error);
    }
  }

  function getStatusStyle(status: string | null) {
    if (status === "NEW") {
      return {
        background: "#7f1d1d",
        color: "#fff",
      };
    }

    if (status === "PREPARING") {
      return {
        background: "#78350f",
        color: "#fff",
      };
    }

    if (status === "READY") {
      return {
        background: "#14532d",
        color: "#fff",
      };
    }

    if (status === "COMPLETED") {
      return {
        background: "#374151",
        color: "#fff",
      };
    }

    return {
      background: "#333",
      color: "#fff",
    };
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "25px",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "5px",
        }}
      >
        🍿 Food Court Orders
      </h1>

      <p
        style={{
          textAlign: "center",
          color: "#aaa",
          marginBottom: "30px",
        }}
      >
        Live orders from cinema seats
      </p>

      {loading && (
        <p style={{ textAlign: "center" }}>
          Loading orders...
        </p>
      )}

      {!loading && orders.length === 0 && (
        <div
          style={{
            textAlign: "center",
            background: "#222",
            padding: "30px",
            borderRadius: "15px",
          }}
        >
          <h2>No orders yet</h2>
          <p style={{ color: "#aaa" }}>
            New customer orders will appear here automatically.
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        {orders.map((order) => {
          const statusStyle = getStatusStyle(order.status);

          return (
            <div
              key={order.id}
              style={{
                background: "#222",
                borderRadius: "18px",
                padding: "22px",
                boxShadow: "0 5px 20px rgba(0,0,0,0.3)",
              }}
            >
              {/* Order Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "15px",
                }}
              >
                <h2 style={{ margin: 0 }}>
                  🔔 {order.order_code}
                </h2>

                <span
                  style={{
                    ...statusStyle,
                    padding: "7px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {order.status || "NEW"}
                </span>
              </div>

              {/* Seat Information */}
              <div
                style={{
                  background: "#333",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "15px",
                }}
              >
                <p style={{ margin: "5px 0" }}>
                  🎬 <strong>Screen:</strong> {order.screen}
                </p>

                <p style={{ margin: "5px 0" }}>
                  💺 <strong>Seat:</strong> {order.seat}
                </p>
              </div>

              {/* Food Items */}
              <h3 style={{ marginBottom: "10px" }}>
                🍴 Food Items
              </h3>

              <div
                style={{
                  background: "#181818",
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "15px",
                }}
              >
                {Array.isArray(order.food_items) &&
                  order.food_items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "9px 0",
                        borderBottom: "1px solid #333",
                      }}
                    >
                      <span>
                        {item.emoji} {item.name}
                      </span>

                      <strong>
                        × {item.quantity}
                      </strong>
                    </div>
                  ))}
              </div>

              {/* Total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "20px",
                  fontWeight: "bold",
                  marginBottom: "18px",
                }}
              >
                <span>Total</span>
                <span>₹{order.total}</span>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() =>
                    updateStatus(order.id, "PREPARING")
                  }
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: "#f59e0b",
                    color: "white",
                    fontWeight: "bold",
                  }}
                >
                  👨‍🍳 Preparing
                </button>

                <button
                  onClick={() =>
                    updateStatus(order.id, "READY")
                  }
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: "bold",
                  }}
                >
                  ✅ Ready
                </button>

                <button
                  onClick={() =>
                    updateStatus(order.id, "COMPLETED")
                  }
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: "#555",
                    color: "white",
                    fontWeight: "bold",
                  }}
                >
                  🎉 Completed
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}