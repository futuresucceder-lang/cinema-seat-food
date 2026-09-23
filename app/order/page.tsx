"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OrderPage() {
  const searchParams = useSearchParams();

  const screen = searchParams.get("screen") || "";
  const seat = searchParams.get("seat") || "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "30px 20px",
        textAlign: "center",
      }}
    >
      <h1>🍿 Cinema Food Ordering</h1>

      <div
        style={{
          marginTop: "30px",
          background: "#222",
          padding: "25px",
          borderRadius: "15px",
        }}
      >
        <h2>Seat Information</h2>

        <p>
          <strong>Screen:</strong> {screen}
        </p>

        <p>
          <strong>Seat:</strong> {seat}
        </p>

        <hr style={{ margin: "25px 0" }} />

        <h2>🍔 Food Menu</h2>

        <p>Select your food and place your order.</p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <OrderPage />
    </Suspense>
  );
}