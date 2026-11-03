"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: number;
  order_code: string;
  total: number | null;
  status: string | null;
  created_at: string;
};

export default function AdminDashboard() {
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.assign("/manager-login");
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cinemaName, setCinemaName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadOrders() {
    setLoading(true);
    setErrorMessage("");

    // --------------------------------------------------
    // 1. Get currently logged-in user
    // --------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Could not get logged-in user:", userError);

      setOrders([]);
      setErrorMessage("You are not logged in.");
      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // 2. Get Manager role + cinema from Auth metadata
    // --------------------------------------------------

    const role =
      user.app_metadata?.role ??
      user.user_metadata?.role;

    const managerCinemaId =
      user.app_metadata?.cinema_id ??
      user.user_metadata?.cinema_id;

    console.log("Manager auth check:", {
      userId: user.id,
      email: user.email,
      role,
      managerCinemaId,
    });

    // --------------------------------------------------
    // 3. Make sure this is a Manager account
    // --------------------------------------------------

    if (role !== "manager") {
      console.error(
        "This account does not have Manager access.",
        {
          email: user.email,
          role,
        }
      );

      setOrders([]);
      setErrorMessage(
        "This account does not have Manager access."
      );
      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // 4. Make sure Manager has a cinema
    // --------------------------------------------------

    if (!managerCinemaId) {
      console.error(
        "Manager does not have a cinema_id in Auth metadata."
      );

      setOrders([]);
      setErrorMessage(
        "Your Manager account is not assigned to a cinema."
      );
      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // 5. Get cinema name
    // --------------------------------------------------

    const {
      data: cinema,
      error: cinemaError,
    } = await supabase
      .from("cinemas")
      .select("id, name")
      .eq("id", managerCinemaId)
      .single();

    if (cinemaError) {
      console.error(
        "Could not load cinema:",
        cinemaError
      );

      setCinemaName("");
    } else if (cinema) {
      setCinemaName(cinema.name);
    }

    // --------------------------------------------------
    // 6. Load ONLY this Manager's cinema orders
    // --------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from("orders")
      .select(
        "id, order_code, total, status, created_at"
      )
      .eq("cinema_id", managerCinemaId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error loading cinema orders:",
        error
      );

      setOrders([]);
      setErrorMessage(
        "Could not load orders for this cinema."
      );
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  // --------------------------------------------------
  // Initial load + realtime updates
  // --------------------------------------------------

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("admin-dashboard-orders")
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

  // --------------------------------------------------
  // Dashboard statistics
  // --------------------------------------------------

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

  const totalSales = orders.reduce(
    (sum, order) =>
      sum + (Number(order.total) || 0),
    0
  );

  const activeOrders =
    newOrders +
    preparingOrders +
    readyOrders;

  return (
    <main className="seatbite-manager-page"
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "30px 20px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <header
          style={{
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <div style={{ fontSize: "55px" }}>
            🎬
          </div>

          <div className="seatbite-dashboard-brand"><img src="/seatbite-logo.webp.jpg" alt="SeatBite" style={{display:"block",width:190,height:"auto",maxHeight:58,objectFit:"contain"}} /></div>
          <h1 className="seatbite-manager-title">Manager Dashboard</h1>

          <p
            style={{
              color: "#aaa",
              margin: 0,
            }}
          >
            Manage cinema seat food orders
          </p>

          {cinemaName && (
            <p
              style={{
                color: "#4ade80",
                marginTop: "10px",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              🎬 {cinemaName}
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              marginTop: "18px",
              padding: "11px 20px",
              border: "1px solid #f05236",
              borderRadius: "9px",
              background: "transparent",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            ↪ Sign Out
          </button>
        </header>

        {/* Error message */}
        {errorMessage && (
          <div
            style={{
              background: "#3b1111",
              border: "1px solid #7f1d1d",
              color: "#fca5a5",
              padding: "15px",
              borderRadius: "12px",
              marginBottom: "25px",
              textAlign: "center",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Live statistics */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "15px",
            marginBottom: "35px",
          }}
        >
          <StatCard
            icon="📥"
            value={newOrders}
            label="New Orders"
          />

          <StatCard
            icon="👨‍🍳"
            value={preparingOrders}
            label="Preparing"
          />

          <StatCard
            icon="✅"
            value={readyOrders}
            label="Ready"
          />

          <StatCard
            icon="🎉"
            value={completedOrders}
            label="Completed"
          />

          <StatCard
            icon="💰"
            value={`₹${totalSales}`}
            label="Total Sales"
          />
        </section>

        {/* Admin Tools */}
        <h2
          style={{
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          Admin Tools
        </h2>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          {/* Food Court */}
          <AdminCard
            href="/food-court"
            icon="🍿"
            title="Food Court"
            description="View incoming orders and update preparation status."
            badge={
              activeOrders > 0
                ? `${activeOrders} active`
                : "No active orders"
            }
          />

          {/* Food Menu */}
          <AdminCard
            href="/admin/food-menu"
            icon="🍔"
            title="Food Menu"
            description="Add, edit, delete and manage food items for this cinema."
            badge="Manage Food Menu"
          />

          {/* Order History */}
          <AdminCard
            href="/order-history"
            icon="📋"
            title="Order History"
            description="Search and review all previous customer orders."
            badge={`${orders.length} orders`}
          />

          {/* QR Generator */}
          <AdminCard
            href="/qr-generator"
            icon="📱"
            title="QR Generator"
            description="Generate and print QR codes for cinema seats."
            badge="Manage QR codes"
          />

          <AdminCard
            href="/show-schedule"
            icon="⏱️"
            title="Show Schedule"
            description="Set show end times and close ordering 30 minutes before the end."
            badge="Manage show times"
          />

          {/* Screens & Seats */}
          <AdminCard
            href="/screens-seats"
            icon="🎟️"
            title="Screens & Seats"
            description="Add screens and manage cinema seats."
            badge="Manage Seats"
          />
        </section>

        {/* Quick Action */}
        <section
          style={{
            background: "#222",
            borderRadius: "18px",
            padding: "25px",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            ⚡ Quick Action
          </h2>

          <p
            style={{
              color: "#aaa",
              marginBottom: "20px",
            }}
          >
            {loading
              ? "Loading live order data..."
              : activeOrders > 0
              ? `There are ${activeOrders} active customer order${
                  activeOrders === 1
                    ? ""
                    : "s"
                } waiting for attention.`
              : "There are currently no active orders."}
          </p>

          <Link
            href="/food-court"
            style={{
              display: "inline-block",
              padding: "13px 25px",
              borderRadius: "10px",
              background: "white",
              color: "#111",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            🍿 Open Food Court
          </Link>
        </section>
      </div>
    </main>
  );
}

// --------------------------------------------------
// Statistics Card
// --------------------------------------------------

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number | string;
  label: string;
}) {
  return (
    <div
      style={{
        background: "#222",
        borderRadius: "15px",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "30px" }}>
        {icon}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          margin: "5px 0",
        }}
      >
        {value}
      </div>

      <div style={{ color: "#aaa" }}>
        {label}
      </div>
    </div>
  );
}

// --------------------------------------------------
// Admin Tool Card
// --------------------------------------------------

function AdminCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "white",
      }}
    >
      <div
        style={{
          background: "#222",
          borderRadius: "18px",
          padding: "25px",
          minHeight: "190px",
          boxSizing: "border-box",
          transition: "transform 0.15s",
        }}
      >
        <div style={{ fontSize: "45px" }}>
          {icon}
        </div>

        <h3
          style={{
            fontSize: "23px",
            margin: "10px 0 8px",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            color: "#aaa",
            lineHeight: "1.5",
            minHeight: "45px",
          }}
        >
          {description}
        </p>

        <span
          style={{
            display: "inline-block",
            marginTop: "8px",
            padding: "6px 10px",
            borderRadius: "20px",
            background: "#333",
            color: "#ddd",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          {badge}
        </span>
      </div>
    </Link>
  );
}