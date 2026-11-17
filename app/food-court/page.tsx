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
  delivery_option?: string | null;
};

type FilterStatus = "ALL" | "NEW" | "PREPARING" | "READY";

export default function FoodCourtPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [cinemaId, setCinemaId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

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
        background: "#f45135",
        color: "#fff",
      };
    }

    if (status === "PREPARING") {
      return {
        background: "#fff0d9",
        color: "#8a4b00",
      };
    }

    if (status === "READY") {
      return {
        background: "#e4f6e9",
        color: "#176534",
      };
    }

    if (status === "COMPLETED") {
      return {
        background: "#f0e5df",
        color: "#59473f",
      };
    }

    return {
      background: "#fff5ef",
      color: "#59473f",
    };
  }

  return (
    <main
      className="seatbite-food-court-page"
      style={{
        minHeight: "100vh",
        background: "#fff8f4",
        color: "#202124",
        padding: "25px",
      }}
    >
      {/* Seat Bite brand header */}
      <header className="seatbite-dashboard-header seatbite-food-court-header">
        <div className="seatbite-dashboard-brand seatbite-food-court-brand">
          <img
            className="seatbite-food-court-logo"
            src="/seatbite-logo.webp.jpg"
            alt="SeatBite"
          />
        </div>
        <h1
          style={{
            textAlign: "center",
            marginBottom: "5px",
          }}
        >
          Food Court Dashboard
        </h1>
        <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              padding: "11px 20px",
              border: "1px solid #f05236",
              borderRadius: "9px",
              background: "#fff",
              color: "#b42318",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            ↪ Sign Out
          </button>
        </div>
      </header>

      <p
        style={{
          textAlign: "center",
          color: "#756b66",
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
        className="seatbite-food-court-stats"
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
          className="seatbite-food-court-stat"
          style={{
            background: "#ffffff",
            color: "#202124",
            border: "1px solid #f0e5df",
            boxShadow: "0 8px 24px rgba(75,42,27,.06)",
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
          className="seatbite-food-court-stat"
          style={{
            background: "#ffffff",
            color: "#202124",
            border: "1px solid #f0e5df",
            boxShadow: "0 8px 24px rgba(75,42,27,.06)",
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
          className="seatbite-food-court-stat"
          style={{
            background: "#ffffff",
            color: "#202124",
            border: "1px solid #f0e5df",
            boxShadow: "0 8px 24px rgba(75,42,27,.06)",
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
          className="seatbite-food-court-stat"
          style={{
            background: "#ffffff",
            color: "#202124",
            border: "1px solid #f0e5df",
            boxShadow: "0 8px 24px rgba(75,42,27,.06)",
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
        className="seatbite-food-court-filters"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "30px",
        }}
      >
        <button
          className="seatbite-food-court-filter"
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
          className="seatbite-food-court-filter"
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
          className="seatbite-food-court-filter"
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
          className="seatbite-food-court-filter"
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
            className="seatbite-food-court-empty"
            style={{
              textAlign: "center",
              background: "#ffffff",
              color: "#202124",
              border: "1px solid #f0e5df",
              padding: "30px",
              borderRadius: "15px",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            <h2>No orders here</h2>
            <p style={{ color: "#756b66" }}>
              New customer orders will appear here
              automatically.
            </p>
          </div>
        )}

      {/* Orders */}
      <div
        className="seatbite-food-court-order-grid"
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
              className="seatbite-food-court-order-card"
              style={{
                background: "#ffffff",
                color: "#202124",
                border: "1px solid #f0e5df",
                borderRadius: "18px",
                padding: "22px",
                boxShadow:
                  "0 12px 30px rgba(75,42,27,.08)",
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
                className="seatbite-food-court-seat-info"
                style={{
                  background: "#fff0e9",
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

              <div className="seatbite-food-court-delivery" style={{marginBottom:15,padding:"10px 12px",borderRadius:10,background:order.delivery_option==="INTERVAL"?"#fff0d9":"#e4f6e9",color:order.delivery_option==="INTERVAL"?"#8a4b00":"#176534",fontWeight:800}}>
                {order.delivery_option==="INTERVAL" ? "⏱ Deliver during interval" : "⚡ Deliver now"}
              </div>

              {/* Food Items */}
              <h3 style={{ marginBottom: "10px" }}>
                🍴 Food Items
              </h3>

              <div
                className="seatbite-food-court-items"
                style={{
                  background: "#fff8f4",
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
                  className="seatbite-food-court-action"
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
                  className="seatbite-food-court-action"
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
                  className="seatbite-food-court-action"
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