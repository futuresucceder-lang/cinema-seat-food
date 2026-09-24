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
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);

  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

  const [error, setError] = useState("");

  const baseUrl = "https://cinema-seat-food.vercel.app/order";

  // Load all screens
  useEffect(() => {
    async function loadScreens() {
      setLoadingScreens(true);
      setError("");

      const { data, error: screenError } = await supabase
        .from("screens")
        .select("id, name")
        .order("name");

      if (screenError) {
        console.error("Screen error:", screenError);
        setError("Failed to load screens.");
        setLoadingScreens(false);
        return;
      }

      const screenData = (data || []) as Screen[];

      setScreens(screenData);

      if (screenData.length > 0) {
        setSelectedScreenId(screenData[0].id);
      } else {
        setError("No screens were found in the database.");
      }

      setLoadingScreens(false);
    }

    loadScreens();
  }, []);

  // Load seats whenever selected screen changes
  useEffect(() => {
    if (!selectedScreenId) {
      setSeats([]);
      return;
    }

    async function loadSeats() {
      setLoadingSeats(true);
      setError("");

      const { data, error: seatError } = await supabase
        .from("seats")
        .select("id, seat_number, is_active")
        .eq("screen_id", selectedScreenId)
        .eq("is_active", true)
        .order("seat_number");

      if (seatError) {
        console.error("Seat error:", seatError);
        setError("Failed to load seats.");
        setSeats([]);
        setLoadingSeats(false);
        return;
      }

      setSeats((data || []) as Seat[]);
      setLoadingSeats(false);
    }

    loadSeats();
  }, [selectedScreenId]);

  const selectedScreen =
    screens.find((screen) => screen.id === selectedScreenId) || null;

  const screenNumber = selectedScreen?.name.replace("Screen ", "") || "";

  function getQrUrl(seat: Seat) {
    return `${baseUrl}?screen=${screenNumber}&seat=${seat.seat_number}`;
  }

  function printQRCodes() {
    window.print();
  }

  function downloadQR(seat: Seat) {
    const container = document.getElementById(`qr-${seat.id}`);

    if (!container) {
      return;
    }

    const svg = container.querySelector("svg");

    if (!svg) {
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);

    const blob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedScreen?.name || "Screen"}-Seat-${seat.seat_number}-QR.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  if (loadingScreens) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: "20px",
        }}
      >
        Loading screens...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
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
        <div
          className="qr-controls"
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "30px",
            }}
          >
            🎬 Cinema Seat QR Generator
          </h1>

          <p
            style={{
              margin: "0 0 22px",
              color: "#666",
            }}
          >
            Generate QR codes for customers to order food directly from their
            cinema seat.
          </p>

          {/* Screen selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="screen"
              style={{
                fontWeight: "bold",
              }}
            >
              Select Screen:
            </label>

            <select
              id="screen"
              value={selectedScreenId}
              onChange={(e) => setSelectedScreenId(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "16px",
                minWidth: "180px",
                background: "white",
              }}
            >
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>

            <button
              onClick={printQRCodes}
              disabled={loadingSeats || seats.length === 0}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background:
                  loadingSeats || seats.length === 0 ? "#aaa" : "#111",
                color: "white",
                cursor:
                  loadingSeats || seats.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
                fontSize: "15px",
              }}
            >
              🖨️ Print All QR Codes
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="qr-controls"
            style={{
              background: "#ffe5e5",
              color: "#b00020",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontWeight: "bold",
            }}
          >
            {error}
          </div>
        )}

        {/* Screen information */}
        {selectedScreen && (
          <div
            className="qr-controls"
            style={{
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                margin: "0 0 5px",
              }}
            >
              {selectedScreen.name}
            </h2>

            <p
              style={{
                margin: 0,
                color: "#666",
              }}
            >
              {loadingSeats
                ? "Loading seats..."
                : `${seats.length} active seat${
                    seats.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
        )}

        {/* Loading seats */}
        {loadingSeats && (
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "16px",
              textAlign: "center",
              fontSize: "18px",
            }}
          >
            Loading seats...
          </div>
        )}

        {/* No seats */}
        {!loadingSeats && seats.length === 0 && !error && (
          <div
            style={{
              background: "white",
              padding: "40px",
              borderRadius: "16px",
              textAlign: "center",
            }}
          >
            <h2>No active seats found</h2>
            <p style={{ color: "#666" }}>
              This screen does not currently have any active seats.
            </p>
          </div>
        )}

        {/* QR codes */}
        {!loadingSeats && seats.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "20px",
            }}
          >
            {seats.map((seat) => {
              const qrUrl = getQrUrl(seat);

              return (
                <div
                  key={seat.id}
                  className="qr-card"
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    padding: "24px",
                    textAlign: "center",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                    breakInside: "avoid",
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 5px",
                      fontSize: "20px",
                    }}
                  >
                    {selectedScreen?.name}
                  </h2>

                  <h3
                    style={{
                      margin: "0 0 18px",
                      fontSize: "26px",
                    }}
                  >
                    Seat {seat.seat_number}
                  </h3>

                  <div
                    id={`qr-${seat.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <QRCodeSVG
                      value={qrUrl}
                      size={180}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <p
                    style={{
                      margin: "0 0 12px",
                      fontWeight: "bold",
                    }}
                  >
                    📱 Scan to order food
                  </p>

                  <button
                    className="qr-download-button"
                    onClick={() => downloadQR(seat)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: "bold",
                      marginBottom: "14px",
                    }}
                  >
                    ⬇️ Download QR
                  </button>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
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
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .qr-controls,
          .qr-download-button {
            display: none !important;
          }

          .qr-card {
            box-shadow: none !important;
            border: 1px solid #ddd;
            page-break-inside: avoid;
          }

          main {
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>
    </main>
  );
}