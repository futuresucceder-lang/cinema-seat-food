"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";

type Seat = {
  id: string;
  seat_number: string;
  is_active: boolean;
};

type Screen = {
  id: string;
  name: string;
};

export default function QRGeneratorPage() {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const baseUrl =
    "https://cinema-seat-food.vercel.app/order";

  useEffect(() => {
    async function loadScreenAndSeats() {
      setLoading(true);
      setError("");

      // Get Screen 1
      const { data: screenRows, error: screenError } =
  await supabase
    .from("screens")
    .select("id, name")
    .eq("name", "Screen 1")
    .limit(1);

if (screenError) {
  console.error("Screen error:", screenError);
  setError(screenError.message);
  setLoading(false);
  return;
}

const screenData = screenRows?.[0];

if (!screenData) {
  setError("Screen 1 was not found in the database.");
  setLoading(false);
  return;
}

      if (screenError) {
        console.error("Screen error:", screenError);
        setError("Failed to load screen data.");
        setLoading(false);
        return;
      }

      setScreen(screenData);

      // Get active seats belonging to Screen 1
      const { data: seatData, error: seatError } =
        await supabase
          .from("seats")
          .select("id, seat_number, is_active")
          .eq("screen_id", screenData.id)
          .eq("is_active", true)
          .order("seat_number");

      if (seatError) {
        console.error("Seat error:", seatError);
        setError(seatError.message);
        setLoading(false);
        return;
      }

      setSeats(seatData || []);
      setLoading(false);
    }

    loadScreenAndSeats();
  }, []);

  if (loading) {
    return (
      <main
        style={{
          padding: "40px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <h1>🎬 Cinema Seat QR Generator</h1>
        <p>Loading seats...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          padding: "40px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <h1>🎬 Cinema Seat QR Generator</h1>

        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            borderRadius: "12px",
            background: "#ffe5e5",
            color: "#b00000",
          }}
        >
          <strong>Could not load cinema seats.</strong>

          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <h1>🎬 Cinema Seat QR Generator</h1>

      <p>
        Print these QR codes and place each one at the
        corresponding seat.
      </p>

      <h2>
        {screen?.name}
      </h2>

      <p>
        {seats.length} active seat(s)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "30px",
          marginTop: "30px",
        }}
      >
        {seats.map((seat) => {
          const qrUrl =
            `${baseUrl}?screen=${screen?.name.replace(
              "Screen ",
              ""
            )}&seat=${seat.seat_number}`;

          return (
            <div
              key={seat.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "12px",
                padding: "20px",
                background: "#fff",
              }}
            >
              <h2>{screen?.name}</h2>

              <h3>Seat {seat.seat_number}</h3>

              <QRCodeSVG
                value={qrUrl}
                size={180}
                level="H"
              />

              <p style={{ marginTop: "15px" }}>
                Scan to order food
              </p>

              <p
                style={{
                  fontSize: "12px",
                  color: "#777",
                  wordBreak: "break-all",
                }}
              >
                {qrUrl}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}