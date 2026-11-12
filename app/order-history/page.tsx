"use client";

import { useEffect, useMemo, useState } from "react";
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

type StatusFilter =
  | "ALL"
  | "NEW"
  | "PREPARING"
  | "READY"
  | "COMPLETED";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [screenFilter, setScreenFilter] = useState("ALL");

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading order history:", error);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("order-history-orders")
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

  const screens = useMemo(() => {
    const uniqueScreens = Array.from(
      new Set(
        orders
          .map((order) => order.screen)
          .filter(Boolean)
      )
    ) as string[];

    return uniqueScreens.sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return orders.filter((order) => {
      const matchesSearch =
        !searchText ||
        order.order_code.toLowerCase().includes(searchText) ||
        (order.seat || "").toLowerCase().includes(searchText) ||
        (order.screen || "").toLowerCase().includes(searchText) ||
        (order.movie || "").toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "ALL" ||
        order.status === statusFilter;

      const matchesScreen =
        screenFilter === "ALL" ||
        order.screen === screenFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesScreen
      );
    });
  }, [orders, search, statusFilter, screenFilter]);

  const totalSales = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const filteredSales = filteredOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const completedCount = orders.filter(
    (order) => order.status === "COMPLETED"
  ).length;

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

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setScreenFilter("ALL");
  }

  return (
    <main
      className="seatbite-order-history-page"
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "25px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <h1
          className="order-history-title"
          style={{
            textAlign: "center",
            marginBottom: "5px",
          }}
        >
          📋 Order History
        </h1>

        <p
          className="order-history-subtitle"
          style={{
            textAlign: "center",
            color: "#aaa",
            marginBottom: "30px",
          }}
        >
          Complete history of cinema food orders
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px" }}>📦</div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              {orders.length}
            </div>

            <div style={{ color: "#aaa" }}>
              Total Orders
            </div>
          </div>

          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px" }}>💰</div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              ₹{totalSales}
            </div>

            <div style={{ color: "#aaa" }}>
              Total Sales
            </div>
          </div>

          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px" }}>🎉</div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              {completedCount}
            </div>

            <div style={{ color: "#aaa" }}>
              Completed Orders
            </div>
          </div>

          <div
            style={{
              background: "#222",
              padding: "20px",
              borderRadius: "15px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "30px" }}>🔎</div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: "bold",
                color: "#ffffff",
              }}
            >
              {filteredOrders.length}
            </div>

            <div style={{ color: "#aaa" }}>
              Showing
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            background: "#222",
            padding: "20px",
            borderRadius: "15px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              marginBottom: "15px",
            }}
          >
            {/* Search */}
            <input
              type="text"
              placeholder="🔎 Search order, seat, screen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#111",
                color: "white",
                fontSize: "15px",
                outline: "none",
              }}
            />

            {/* Screen */}
            <select
              value={screenFilter}
              onChange={(e) =>
                setScreenFilter(e.target.value)
              }
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#111",
                color: "white",
                fontSize: "15px",
              }}
            >
              <option value="ALL">
                🎬 All Screens
              </option>

              {screens.map((screen) => (
                <option key={screen} value={screen}>
                  {screen}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as StatusFilter
                )
              }
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #555",
                background: "#111",
                color: "white",
                fontSize: "15px",
              }}
            >
              <option value="ALL">
                📋 All Statuses
              </option>

              <option value="NEW">
                📥 New
              </option>

              <option value="PREPARING">
                👨‍🍳 Preparing
              </option>

              <option value="READY">
                ✅ Ready
              </option>

              <option value="COMPLETED">
                🎉 Completed
              </option>
            </select>

            <button
              onClick={clearFilters}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "#444",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ✖ Clear Filters
            </button>
          </div>

          <div
            style={{
              color: "#aaa",
              fontSize: "14px",
            }}
          >
            Showing {filteredOrders.length} order
            {filteredOrders.length === 1 ? "" : "s"}
            {" • "}
            Filtered sales: ₹{filteredSales}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <p
            style={{
              textAlign: "center",
              color: "#aaa",
            }}
          >
            Loading order history...
          </p>
        )}

        {/* No orders */}
        {!loading && filteredOrders.length === 0 && (
          <div
            style={{
              textAlign: "center",
              background: "#222",
              padding: "40px",
              borderRadius: "15px",
            }}
          >
            <div style={{ fontSize: "50px" }}>
              📭
            </div>

            <h2>No orders found</h2>

            <p style={{ color: "#aaa" }}>
              Try changing your search or filters.
            </p>
          </div>
        )}

        {/* Orders */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {filteredOrders.map((order) => {
            const statusStyle = getStatusStyle(
              order.status
            );

            return (
              <div
                key={order.id}
                style={{
                  background: "#222",
                  borderRadius: "18px",
                  padding: "22px",
                  boxShadow:
                    "0 5px 20px rgba(0,0,0,0.3)",
                }}
              >
                {/* Order header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "15px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      color: "#ffffff",
                    }}
                  >
                    🔔 {order.order_code}
                  </h2>

                  <span
                    style={{
                      ...statusStyle,
                      padding: "7px 12px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {order.status || "NEW"}
                  </span>
                </div>

                {/* Order information */}
                <div
                  style={{
                    background: "#333",
                    padding: "15px",
                    borderRadius: "12px",
                    marginBottom: "15px",
                  }}
                >
                  <p style={{ margin: "6px 0", color: "#f5f5f5" }}>
                    🎬 <strong>Screen:</strong>{" "}
                    {order.screen || "-"}
                  </p>

                  <p style={{ margin: "6px 0", color: "#f5f5f5" }}>
                    💺 <strong>Seat:</strong>{" "}
                    {order.seat || "-"}
                  </p>

                  <p style={{ margin: "6px 0", color: "#f5f5f5" }}>
                    🎞️ <strong>Movie:</strong>{" "}
                    {order.movie || "-"}
                  </p>

                  <p style={{ margin: "6px 0", color: "#f5f5f5" }}>
                    🕐 <strong>Ordered:</strong>{" "}
                    {formatDate(order.created_at)}
                  </p>
                </div>

                {/* Food items */}
                <h3
                  style={{
                    marginBottom: "10px",
                    color: "#ffffff",
                  }}
                >
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
                  order.food_items.length > 0 ? (
                    order.food_items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                          padding: "9px 0",
                          borderBottom:
                            "1px solid #333",
                        }}
                      >
                        <span style={{ color: "#f5f5f5" }}>
                          {item.emoji} {item.name}
                        </span>

                        <span style={{ color: "#f5f5f5" }}>
                          × {item.quantity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p
                      style={{
                        color: "#aaa",
                        margin: 0,
                      }}
                    >
                      No food items recorded.
                    </p>
                  )}
                </div>

                {/* Total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#ffffff",
                  }}
                >
                  <span>Total</span>

                  <span>
                    ₹{order.total || 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}