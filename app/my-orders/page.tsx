"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
type FoodItem = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  emoji?: string;
};

type Order = {
  id?: number;
  cinema_id?: string | null;
  delivery_option?: string | null;
  order_code: string;
  movie: string | null;
  screen: string | null;
  seat: string | null;
  food_items: FoodItem[];
  total: number | null;
  status: string | null;
  created_at: string;
};

export default function MyOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const savedCodes = JSON.parse(
          localStorage.getItem("cinema_order_codes") || "[]"
        );

        if (!Array.isArray(savedCodes) || savedCodes.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const validCodes = savedCodes.filter((code): code is string => typeof code === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code));
        if (validCodes.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const response = await fetch("/api/customer/orders?codes=" + encodeURIComponent(validCodes.join(",")), { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) {
          console.error("Error loading orders:", result.error);
          setOrders([]);
        } else {
          setOrders((result.orders || []) as Order[]);
        }
      } catch (error) {
        console.error("Error reading saved orders:", error);
        setOrders([]);
      }

      setLoading(false);
    }

    loadOrders();
  }, []);

  function trackOrder(orderCode: string) {
    router.push(
      `/order-status?order=${encodeURIComponent(orderCode)}`
    );
  }

  function getStatusLabel(status: string | null) {
    switch ((status || "").toUpperCase()) {
      case "NEW":
        return "🆕 New";
      case "PREPARING":
        return "👨‍🍳 Preparing";
      case "READY":
        return "✅ Ready";
      case "COMPLETED":
        return "🎉 Completed";
      default:
        return status || "Unknown";
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <p>Loading your orders...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: "20px",
          padding: "10px 16px",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: "8px" }}>📋 My Orders</h1>

      <p style={{ color: "#666", marginBottom: "24px" }}>
        View orders placed from this device.
      </p>

      {orders.length === 0 ? (
        <div
          style={{
            padding: "32px",
            border: "1px solid #ddd",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>
            🧾
          </div>

          <h2>No orders found</h2>

          <p style={{ color: "#666" }}>
            Orders placed on this device will appear here.
          </p>

          <button
            onClick={() => router.push("/order")}
            style={{
              marginTop: "16px",
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "18px" }}>
          {orders.map((order) => (
            <div
              key={order.order_code}
              style={{
                border: "1px solid #ddd",
                borderRadius: "14px",
                padding: "20px",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>
                    {order.order_code}
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#666",
                      fontSize: "14px",
                    }}
                  >
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>

                <strong>
                  {getStatusLabel(order.status)}
                </strong>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "6px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  🎬 Screen: <strong>{order.screen || "—"}</strong>
                </div>

                <div>
                  💺 Seat: <strong>{order.seat || "—"}</strong>
                </div>

                <div>
                  💰 Total:{" "}
                  <strong>
                    ₹{Number(order.total || 0).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <strong>🍿 Items</strong>

                <div
                  style={{
                    marginTop: "8px",
                    display: "grid",
                    gap: "5px",
                  }}
                >
                  {(order.food_items || []).map((item, index) => (
                    <div key={`${item.id}-${index}`}>
                      {item.emoji || "🍽️"} {item.name} ×{" "}
                      {item.quantity}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => trackOrder(order.order_code)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                📍 Track This Order
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}