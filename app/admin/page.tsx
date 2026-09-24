"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  order_code: string;
  total: number | null;
  status: string | null;
  created_at: string;
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_code, total, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading dashboard:", error);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

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
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const activeOrders =
    newOrders + preparingOrders + readyOrders;

  return (
    <main
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
          <div style={{ fontSize: "55px" }}>🎬</div>

          <h1
            style={{
              fontSize: "36px",
              margin: "5px 0",
            }}
          >
            Cinema Food Admin
          </h1>

          <p
            style={{
              color: "#aaa",
              margin: 0,
            }}
          >
            Manage cinema seat food orders
          </p>
        </header>

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

        {/* Main navigation */}
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

          <AdminCard
            href="/order-history"
            icon="📋"
            title="Order History"
            description="Search and review all previous customer orders."
            badge={`${orders.length} orders`}
          />

          <AdminCard
            href="/qr-generator"
            icon="📱"
            title="QR Generator"
            description="Generate and print QR codes for cinema seats."
            badge="Manage QR codes"
          />

          <AdminCard
  href="/screens-seats"
  icon="🎬"
  title="Screens & Seats"
  description="Add screens and manage cinema seats"
/>
        </section>

        {/* Quick action */}
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
                  activeOrders === 1 ? "" : "s"
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
      <div style={{ fontSize: "30px" }}>{icon}</div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          margin: "5px 0",
        }}
      >
        {value}
      </div>

      <div style={{ color: "#aaa" }}>{label}</div>
    </div>
  );
}

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
        <div style={{ fontSize: "45px" }}>{icon}</div>

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