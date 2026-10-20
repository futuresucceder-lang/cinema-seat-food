"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

const supabase = createClient();

type FoodItem = {
  id?: string;
  name: string;
  price?: number;
  emoji?: string;
  quantity?: number;
};

type Order = {
  order_code: string;
  movie: string | null;
  screen: string;
  seat: string;
  food_items: FoodItem[];
  total: number;
  status: string;
  created_at: string;
};

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("order");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderCode) {
      setError("Order ID is missing.");
      setLoading(false);
      return;
    }

    async function loadOrder() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_code", orderCode)
        .single();

      if (error) {
        console.error(error);
        setError("Order not found.");
      } else {
        setOrder(data);
      }

      setLoading(false);
    }

    loadOrder();

    // Listen for changes to this order
    const channel = supabase
      .channel(`order-status-${orderCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `order_code=eq.${orderCode}`,
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderCode]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fff8f4] text-[#202124] flex items-center justify-center">
        <p className="text-xl">Loading your order...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-[#fff8f4] text-[#202124] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-4">❌ {error}</p>
          <a
            href="/"
            className="text-[#f45135] underline"
          >
            Back to menu
          </a>
        </div>
      </main>
    );
  }

  const status = order.status.toUpperCase();

  return (
    <main className="min-h-screen bg-[#fff8f4] text-[#202124] px-5 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <div className="seatbite-dashboard-brand">
            <span className="seatbite-dashboard-logo" aria-hidden="true">🍿</span>
            <span className="seatbite-dashboard-wordmark">seat bite</span>
          </div>
          <h1 className="text-3xl font-bold">
            Track Your Order
          </h1>

          <p className="text-[#756b66] mt-2">
            Your food will be delivered to your cinema seat.
          </p>
        </div>

        {/* Order ID */}
        <div className="bg-white shadow-sm border border-[#f0e5df] rounded-2xl p-6 mb-5 text-center">
          <p className="text-[#756b66]">Order ID</p>

          <p className="text-xl font-bold text-[#f45135] mt-2">
            {order.order_code}
          </p>
        </div>

        {/* Seat information */}
        <div className="bg-white shadow-sm border border-[#f0e5df] rounded-2xl p-6 mb-5">
          <h2 className="text-xl font-bold mb-4">
            🎟️ Delivery Location
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#fff5ef] rounded-xl p-4">
              <p className="text-[#756b66]">Screen</p>
              <p className="text-lg font-bold">
                {order.screen}
              </p>
            </div>

            <div className="bg-[#fff5ef] rounded-xl p-4">
              <p className="text-[#756b66]">Seat</p>
              <p className="text-lg font-bold">
                {order.seat}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white shadow-sm border border-[#f0e5df] rounded-2xl p-6 mb-5">
          <h2 className="text-xl font-bold mb-6">
            📦 Order Status
          </h2>

          <div className="flex items-center justify-between">

            <StatusStep
              label="Preparing"
              active={
                status === "PREPARING" ||
                status === "READY" ||
                status === "COMPLETED"
              }
              emoji="👨‍🍳"
            />

            <div className="h-1 flex-1 bg-[#f0e5df] mx-2">
              <div
                className={`h-full ${
                  status === "READY" || status === "COMPLETED"
                    ? "bg-[#16803d]"
                    : "bg-[#f0e5df]"
                }`}
              />
            </div>

            <StatusStep
              label="Ready"
              active={
                status === "READY" ||
                status === "COMPLETED"
              }
              emoji="✅"
            />

            <div className="h-1 flex-1 bg-[#f0e5df] mx-2">
              <div
                className={`h-full ${
                  status === "COMPLETED"
                    ? "bg-[#16803d]"
                    : "bg-[#f0e5df]"
                }`}
              />
            </div>

            <StatusStep
              label="Completed"
              active={status === "COMPLETED"}
              emoji="🎉"
            />

          </div>

          <div className="text-center mt-7">
            <span
              className={`inline-block px-6 py-3 rounded-full font-bold ${
                status === "PREPARING"
                  ? "bg-[#f45135] text-white"
                  : status === "READY"
                  ? "bg-[#16803d] text-white"
                  : "bg-[#202124] text-white"
              }`}
            >
              {status === "PREPARING" && "👨‍🍳 Your order is being prepared"}
              {status === "READY" && "✅ Your order is ready!"}
              {status === "COMPLETED" && "🎉 Order completed"}
            </span>
          </div>
        </div>

        {/* Food items */}
        <div className="bg-white shadow-sm border border-[#f0e5df] rounded-2xl p-6 mb-5">
          <h2 className="text-xl font-bold mb-4">
            🍿 Your Food
          </h2>

          <div className="space-y-3">
            {order.food_items?.map((item, index) => (
              <div
                key={item.id ?? index}
                className="flex justify-between bg-[#fff5ef] rounded-xl p-4"
              >
                <span>
                  {item.emoji ?? "🍿"} {item.name}
                </span>

                <span className="font-bold">
                  × {item.quantity ?? 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-white shadow-sm border border-[#f0e5df] rounded-2xl p-6 flex justify-between items-center">
          <span className="text-xl font-bold">
            Total
          </span>

          <span className="text-2xl font-bold text-[#16803d]">
            ₹{order.total}
          </span>
        </div>

        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-block bg-[#f45135] text-white px-8 py-3 rounded-xl font-bold"
          >
            BACK TO MENU
          </a>
        </div>

      </div>
    </main>
  );
}

function StatusStep({
  label,
  active,
  emoji,
}: {
  label: string;
  active: boolean;
  emoji: string;
}) {
  return (
    <div
      className={`text-center min-w-[75px] ${
        active ? "opacity-100" : "opacity-40"
      }`}
    >
      <div className="text-2xl">{emoji}</div>

      <p className="text-xs mt-2 font-semibold">
        {label}
      </p>
    </div>
  );
}
export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fff8f4] text-[#202124] flex items-center justify-center">
          <p className="text-xl">Loading your order...</p>
        </main>
      }
    >
      <OrderStatusContent />
    </Suspense>
  );
}