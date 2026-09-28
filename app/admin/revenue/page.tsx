"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type FoodItem = {
  id?: string | number;
  name?: string;
  price?: number;
  quantity?: number;
};

type Order = {
  id: number;
  order_code: string;
  total: number | null;
  status: string | null;
  food_items: FoodItem[] | null;
  created_at: string;
};

export default function RevenueDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_code, total, status, food_items, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Revenue dashboard error:", error);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("revenue-dashboard-orders")
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

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const weekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;

    date.setDate(date.getDate() - diff);

    return date;
  }, []);

  const todayOrders = orders.filter(
    (order) => new Date(order.created_at) >= todayStart
  );

  const weekOrders = orders.filter(
    (order) => new Date(order.created_at) >= weekStart
  );

  const todayRevenue = todayOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const weekRevenue = weekOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const totalRevenue = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );

  const completedRevenue = orders
    .filter((order) => order.status === "COMPLETED")
    .reduce(
      (sum, order) => sum + (Number(order.total) || 0),
      0
    );

  const topItems = useMemo(() => {
    const itemMap: Record<
      string,
      {
        name: string;
        quantity: number;
        revenue: number;
      }
    > = {};

    orders.forEach((order) => {
      if (!Array.isArray(order.food_items)) return;

      order.food_items.forEach((item) => {
        const name = item.name || "Unknown Item";
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        if (!itemMap[name]) {
          itemMap[name] = {
            name,
            quantity: 0,
            revenue: 0,
          };
        }

        itemMap[name].quantity += quantity;
        itemMap[name].revenue += price * quantity;
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders]);

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
        <Link
          href="/admin"
          style={{
            color: "#aaa",
            textDecoration: "none",
          }}
        >
          ← Back to Admin Dashboard
        </Link>

        <header
          style={{
            textAlign: "center",
            margin: "30px 0 40px",
          }}
        >
          <div style={{ fontSize: "55px" }}>💰</div>

          <h1
            style={{
              fontSize: "36px",
              margin: "5px 0",
            }}
          >
            Revenue Dashboard
          </h1>

          <p
            style={{
              color: "#aaa",
              margin: 0,
            }}
          >
            Monitor cinema food sales and popular items
          </p>
        </header>

        {/* REVENUE CARDS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "15px",
            marginBottom: "35px",
          }}
        >
          <RevenueCard
            icon="💰"
            title="Today's Revenue"
            value={`₹${todayRevenue}`}
          />

          <RevenueCard
            icon="📅"
            title="This Week"
            value={`₹${weekRevenue}`}
          />

          <RevenueCard
            icon="🏦"
            title="Total Revenue"
            value={`₹${totalRevenue}`}
          />

          <RevenueCard
            icon="✅"
            title="Completed Sales"
            value={`₹${completedRevenue}`}
          />
        </section>

        {/* ORDER COUNTS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "15px",
            marginBottom: "35px",
          }}
        >
          <InfoCard
            icon="🧾"
            title="Orders Today"
            value={todayOrders.length}
          />

          <InfoCard
            icon="📦"
            title="Orders This Week"
            value={weekOrders.length}
          />

          <InfoCard
            icon="📊"
            title="All Orders"
            value={orders.length}
          />

          <InfoCard
            icon="🛒"
            title="Average Order"
            value={
              orders.length > 0
                ? `₹${Math.round(
                    totalRevenue / orders.length
                  )}`
                : "₹0"
            }
          />
        </section>

        {/* TOP FOOD ITEMS */}
        <section
          style={{
            background: "#222",
            borderRadius: "18px",
            padding: "25px",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            🍿 Top Selling Food Items
          </h2>

          {loading ? (
            <p style={{ color: "#aaa" }}>
              Loading sales data...
            </p>
          ) : topItems.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No food sales available yet.
            </p>
          ) : (
            <div>
              {topItems.map((item, index) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "15px 0",
                    borderBottom:
                      index === topItems.length - 1
                        ? "none"
                        : "1px solid #333",
                  }}
                >
                  <div>
                    <strong>
                      {index + 1}. {item.name}
                    </strong>

                    <div
                      style={{
                        color: "#aaa",
                        marginTop: "5px",
                      }}
                    >
                      {item.quantity} sold
                    </div>
                  </div>

                  <strong>
                    ₹{item.revenue}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RECENT ORDERS */}
        <section
          style={{
            background: "#222",
            borderRadius: "18px",
            padding: "25px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            🧾 Recent Orders
          </h2>

          {loading ? (
            <p style={{ color: "#aaa" }}>
              Loading orders...
            </p>
          ) : orders.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No orders yet.
            </p>
          ) : (
            <div>
              {orders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "15px",
                    padding: "15px 0",
                    borderBottom: "1px solid #333",
                  }}
                >
                  <div>
                    <strong>
                      {order.order_code}
                    </strong>

                    <div
                      style={{
                        color: "#aaa",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {new Date(
                        order.created_at
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong>
                      ₹{Number(order.total) || 0}
                    </strong>

                    <div
                      style={{
                        color: "#aaa",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {order.status || "UNKNOWN"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div
          style={{
            textAlign: "center",
            marginTop: "30px",
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "inline-block",
              padding: "12px 22px",
              borderRadius: "10px",
              background: "white",
              color: "#111",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            ← Admin Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function RevenueCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#222",
        borderRadius: "15px",
        padding: "22px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "32px" }}>{icon}</div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          margin: "8px 0",
        }}
      >
        {value}
      </div>

      <div style={{ color: "#aaa" }}>
        {title}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        background: "#222",
        borderRadius: "15px",
        padding: "22px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "30px" }}>{icon}</div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          margin: "8px 0",
        }}
      >
        {value}
      </div>

      <div style={{ color: "#aaa" }}>
        {title}
      </div>
    </div>
  );
}