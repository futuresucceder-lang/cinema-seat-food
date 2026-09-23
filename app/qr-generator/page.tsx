"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRGeneratorPage() {
  const [screen, setScreen] = useState("3");
  const [seat, setSeat] = useState("F12");

  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?screen=${encodeURIComponent(
          screen
        )}&seat=${encodeURIComponent(seat)}`
      : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: "30px" }}>
        Cinema Seat QR Generator
      </h1>

      <div
        style={{
          maxWidth: "400px",
          margin: "0 auto",
          background: "#222",
          padding: "25px",
          borderRadius: "15px",
        }}
      >
        <label
          style={{
            display: "block",
            textAlign: "left",
            marginBottom: "8px",
          }}
        >
          Screen Number
        </label>

        <input
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          placeholder="Example: 3"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "20px",
            borderRadius: "8px",
            border: "1px solid #555",
            fontSize: "16px",
          }}
        />

        <label
          style={{
            display: "block",
            textAlign: "left",
            marginBottom: "8px",
          }}
        >
          Seat Number
        </label>

        <input
          value={seat}
          onChange={(e) => setSeat(e.target.value)}
          placeholder="Example: F12"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "25px",
            borderRadius: "8px",
            border: "1px solid #555",
            fontSize: "16px",
          }}
        />

        {qrUrl && (
          <>
            <div
              style={{
                background: "white",
                padding: "20px",
                display: "inline-block",
                borderRadius: "12px",
              }}
            >
              <QRCodeSVG
                value={qrUrl}
                size={250}
                level="H"
              />
            </div>

            <h2 style={{ marginTop: "20px" }}>
              Screen {screen} • Seat {seat}
            </h2>

            <p
              style={{
                fontSize: "12px",
                color: "#aaa",
                wordBreak: "break-all",
              }}
            >
              {qrUrl}
            </p>

            <button
              onClick={() => window.print()}
              style={{
                marginTop: "20px",
                padding: "12px 25px",
                borderRadius: "8px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              PRINT QR
            </button>
          </>
        )}
      </div>
    </main>
  );
}