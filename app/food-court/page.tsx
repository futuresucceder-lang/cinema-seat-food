"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
  cinema_id: string | null;
};

type FilterStatus = "ALL" | "NEW" | "PREPARING" | "READY";

export default function FoodCourtPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [cinemaId, setCinemaId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");

  async function getFoodCourtCinemaId() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error("Food Court auth error:", error);
      setAuthError("You are not logged in.");
      setLoading(false);
      return null;
    }

    const role =
      user.app_metadata?.role ??
      user.user_metadata?.role;

    const userCinemaId =
      user.app_metadata?.cinema_id ??
      user.user_metadata?.cinema_id;

    console.log("Food Court user:", user.email);
    console.log("Food Court role:", role);
    console.log("Food Court cinema ID:", userCinemaId);

    if (role !== "food_court") {
      console.error("This account is not a Food Court account.");
      setAuthError("This account is not a Food Court account.");
      setLoading(false);
      return null;
    }

    if (!userCinemaId) {
      console.error("No cinema assigned to this Food Court account.");
      setAuthError("No cinema is assigned to this Food Court account.");
      setLoading(false);
      return null;
    }

    setCinemaId(userCinemaId);
    return userCinemaId;
  }

  async function loadOrders(targetCinemaId?: string) {
    const currentCinemaId =
      targetCinemaId ?? cinemaId;

    if (!currentCinemaId) {
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("cinema_id", currentCinemaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading orders:", error);
      setLoading(false);
      return;
    }

    console.log(
      "Loaded orders for cinema:",
      currentCinemaId,
      data
    );

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupFoodCourt() {
      const currentCinemaId =
        await getFoodCourtCinemaId();

      if (!currentCinemaId) {
        return;
      }

      await loadOrders(currentCinemaId);

      channel = supabase
        .channel(
          `food-court-orders-${currentCinemaId}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `cinema_id=eq.${currentCinemaId}`,
          },
          () => {
            loadOrders(currentCinemaId);
          }
        )
        .subscribe((status) => {
          console.log(
            "Food Court realtime status:",
            status
          );
        });
    }

    setupFoodCourt();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function updateStatus(
    id: number,
    status: string
  ) {
    if (!cinemaId) {
      alert("Cinema information is missing.");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .eq("cinema_id", cinemaId);

    if (error) {
      console.error(
        "Error updating order:",
        error
      );
      alert(
        "Status update failed: " +
          error.message
      );
      return;
    }

    console.log(
      "Order status updated successfully:",
      id,
      status,
      "Cinema:",
      cinemaId
    );

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === id
          ? { ...order, status }
          : order
      )
    );
  }

  const newOrders = orders.filter(
    (order) => order.status === "NEW"
  ).length;

  const preparingOrders = orders.filter(
    (order) => order.status === "PREPARING"
  ).length;

  const readyOrders = orders.filter(
    (order) => order.status === "READY"
  ).length;

  const completedOrders = orders.filter(
    (order) => order.status === "COMPLETED"
  ).length;

  const filteredOrders = orders.filter((order) => {
    if (filter === "ALL") {
      return order.status !== "COMPLETED";
    }

    return order.status === filter;
  });

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
      {/* Header */}
      <h1
        style={{
          textAlign: "center",
          marginBottom: "5px",
        }}
      >
        🍿 Food Court Dashboard
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

      {authError && (
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto 30px",
            background: "#7f1d1d",
            padding: "15px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          {authError}
        </div>
      )}

      {/* Dashboard Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "15px",
          maxWidth: "1200px",
          margin: "0 auto 30px",
        }}
      >
        {/* New */}
        <div
          style={{
            background: "#7f1d1d",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "30px" }}>
            📥
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {newOrders}
          </div>
          <div>New Orders</div>
        </div>

        {/* Preparing */}
        <div
          style={{
            background: "#78350f",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "30px" }}>
            👨‍🍳
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {preparingOrders}
          </div>
          <div>Preparing</div>
        </div>

        {/* Ready */}
        <div
          style={{
            background: "#14532d",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "30px" }}>
            ✅
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {readyOrders}
          </div>
          <div>Ready</div>
        </div>

        {/* Completed */}
        <div
          style={{
            background: "#374151",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "30px" }}>
            🎉
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {completedOrders}
          </div>
          <div>Completed</div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "30px",
        }}
      >
        <button
          onClick={() => setFilter("ALL")}
          style={{
            padding: "11px 18px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background:
              filter === "ALL"
                ? "#fff"
                : "#333",
            color:
              filter === "ALL"
                ? "#111"
                : "#fff",
            fontWeight: "bold",
          }}
        >
          📋 Active Orders
        </button>

        <button
          onClick={() => setFilter("NEW")}
          style={{
            padding: "11px 18px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background:
              filter === "NEW"
                ? "#dc2626"
                : "#333",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          📥 New ({newOrders})
        </button>

        <button
          onClick={() => setFilter("PREPARING")}
          style={{
            padding: "11px 18px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background:
              filter === "PREPARING"
                ? "#d97706"
                : "#333",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          👨‍🍳 Preparing ({preparingOrders})
        </button>

        <button
          onClick={() => setFilter("READY")}
          style={{
            padding: "11px 18px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background:
              filter === "READY"
                ? "#16a34a"
                : "#333",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          ✅ Ready ({readyOrders})
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <p style={{ textAlign: "center" }}>
          Loading orders...
        </p>
      )}

      {/* No Orders */}
      {!loading &&
        !authError &&
        filteredOrders.length === 0 && (
          <div
            style={{
              textAlign: "center",
              background: "#222",
              padding: "30px",
              borderRadius: "15px",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            <h2>No orders here</h2>
            <p style={{ color: "#aaa" }}>
              New customer orders will appear here
              automatically.
            </p>
          </div>
        )}

      {/* Orders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {filteredOrders.map((order) => {
          const statusStyle =
            getStatusStyle(order.status);

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
              {/* Order Header */}
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
                  }}
                >
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
                  🎬 <strong>Screen:</strong>{" "}
                  {order.screen}
                </p>

                <p style={{ margin: "5px 0" }}>
                  💺 <strong>Seat:</strong>{" "}
                  {order.seat}
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
                        justifyContent:
                          "space-between",
                        padding: "9px 0",
                        borderBottom:
                          "1px solid #333",
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
                  justifyContent:
                    "space-between",
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
                    updateStatus(
                      order.id,
                      "PREPARING"
                    )
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
                    updateStatus(
                      order.id,
                      "READY"
                    )
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
                    updateStatus(
                      order.id,
                      "COMPLETED"
                    )
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