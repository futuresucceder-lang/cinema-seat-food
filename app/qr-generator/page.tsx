"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";

type Screen = {
  id: string;
  cinema_id: string;
  name: string;
};

type Seat = {
  id: string;
  screen_id: string;
  seat_number: string;
  is_active: boolean;
};

export default function QRGeneratorPage() {
  const supabase = createClient();

  const [screens, setScreens] = useState<Screen[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedScreenId, setSelectedScreenId] =
    useState("");

  const [cinemaId, setCinemaId] = useState("");
  const [cinemaName, setCinemaName] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Load Manager's cinema and its screens
  // --------------------------------------------------

  useEffect(() => {
    loadCinemaAndScreens();
  }, []);

  async function loadCinemaAndScreens() {
    setLoading(true);
    setError("");

    // ----------------------------------------------
    // 1. Get logged-in Manager
    // ----------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Could not get logged-in user:",
        userError
      );

      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    // ----------------------------------------------
    // 2. Get role and cinema from Auth metadata
    // ----------------------------------------------

    const role =
      user.app_metadata?.role ||
      user.user_metadata?.role;

    const managerCinemaId =
      user.app_metadata?.cinema_id ||
      user.user_metadata?.cinema_id;

    if (role !== "manager") {
      console.error(
        "This account is not a Manager account."
      );

      setError(
        "Only a cinema Manager can access QR Generator."
      );
      setLoading(false);
      return;
    }

    if (!managerCinemaId) {
      console.error(
        "Manager has no cinema_id in Auth metadata."
      );

      setError(
        "Could not find your cinema assignment."
      );
      setLoading(false);
      return;
    }

    setCinemaId(managerCinemaId);

    // ----------------------------------------------
    // 3. Load cinema name
    // ----------------------------------------------

    const {
      data: cinema,
      error: cinemaError,
    } = await supabase
      .from("cinemas")
      .select("id, name")
      .eq("id", managerCinemaId)
      .single();

    if (cinemaError || !cinema) {
      console.error(
        "Could not load cinema:",
        cinemaError
      );

      setError("Could not load your cinema.");
      setLoading(false);
      return;
    }

    setCinemaName(cinema.name);

    // ----------------------------------------------
    // 4. Load ONLY this cinema's screens
    // ----------------------------------------------

    const {
      data: screenData,
      error: screenError,
    } = await supabase
      .from("screens")
      .select("id, cinema_id, name")
      .eq("cinema_id", managerCinemaId)
      .order("name");

    if (screenError) {
      console.error(
        "Could not load screens:",
        screenError
      );

      setError("Failed to load screens.");
      setLoading(false);
      return;
    }

    const loadedScreens =
      (screenData || []) as Screen[];

    setScreens(loadedScreens);

    if (loadedScreens.length > 0) {
      setSelectedScreenId(loadedScreens[0].id);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // Load seats for selected screen
  // --------------------------------------------------

  useEffect(() => {
    if (!selectedScreenId) {
      setSeats([]);
      return;
    }

    loadSeats(selectedScreenId);
  }, [selectedScreenId]);

  async function loadSeats(screenId: string) {
    setError("");

    const {
      data,
      error: seatError,
    } = await supabase
      .from("seats")
      .select(
        "id, screen_id, seat_number, is_active"
      )
      .eq("screen_id", screenId)
      .eq("is_active", true)
      .order("seat_number");

    if (seatError) {
      console.error(seatError);

      setError("Failed to load seats.");
      setSeats([]);

      return;
    }

    setSeats((data || []) as Seat[]);
  }

  // --------------------------------------------------
  // Selected screen
  // --------------------------------------------------

  const selectedScreen = useMemo(() => {
    return screens.find(
      (screen) => screen.id === selectedScreenId
    );
  }, [screens, selectedScreenId]);

  // --------------------------------------------------
  // Convert "Screen 4" → "4"
  // --------------------------------------------------

  function getScreenNumber(screenName: string) {
    const match = screenName.match(/\d+/);

    if (match) {
      return match[0];
    }

    return screenName.trim();
  }

  // --------------------------------------------------
  // Create cinema-specific QR URL
  // --------------------------------------------------

  function getQrUrl(seatNumber: string) {
    const screenNumber = getScreenNumber(
      selectedScreen?.name || ""
    );

    const baseUrl =
      "https://cinema-seat-food.vercel.app";

    return `${baseUrl}/order?cinema=${encodeURIComponent(
      cinemaId
    )}&screen=${encodeURIComponent(
      screenNumber
    )}&seat=${encodeURIComponent(seatNumber)}`;
  }

  // --------------------------------------------------
  // Download individual QR
  // --------------------------------------------------

  function downloadQr(seat: Seat) {
    const svg = document.getElementById(
      `qr-${seat.id}`
    ) as SVGElement | null;

    if (!svg) {
      return;
    }

    const serializer = new XMLSerializer();

    const svgString =
      serializer.serializeToString(svg);

    const blob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `${
      cinemaName || "Cinema"
    }-Screen-${getScreenNumber(
      selectedScreen?.name || ""
    )}-${seat.seat_number}.svg`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------
  // Print all QR codes
  // --------------------------------------------------

  function printAll() {
    window.print();
  }

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="seatbite-qr-generator-page min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold">
            QR Generator
          </h1>

          <p className="mt-4 text-slate-400">
            Loading your cinema...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              QR Generator
            </h1>

            <p className="text-slate-400 mt-1">
              Generate seat QR codes for customer
              food ordering.
            </p>

            {cinemaName && (
              <div className="inline-flex items-center gap-2 mt-3 rounded-xl border-2 border-orange-500/70 bg-orange-500/10 px-4 py-2.5 text-orange-400 font-bold tracking-wide shadow-[0_0_18px_rgba(249,115,22,0.12)]">
                <span aria-hidden="true" className="text-lg">🎬</span>
                <span>{cinemaName}</span>
              </div>
            )}
          </div>

          <button
            onClick={printAll}
            disabled={seats.length === 0}
            className="bg-white text-black px-5 py-3 rounded-xl font-semibold disabled:opacity-40"
          >
            🖨️ Print All QR Codes
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* SCREEN SELECTOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8">
          <label className="block text-sm text-white mb-2">
            Select Screen
          </label>

          <select
            value={selectedScreenId}
            onChange={(e) =>
              setSelectedScreenId(e.target.value)
            }
            className="w-full md:w-96 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
          >
            {screens.map((screen) => (
              <option
                key={screen.id}
                value={screen.id}
              >
                {screen.name}
              </option>
            ))}
          </select>

          <div className="mt-3 text-sm text-white">
            {selectedScreen?.name ||
              "No screen selected"}{" "}
            • {seats.length} active seats
          </div>
        </div>

        {/* NO SCREENS */}
        {screens.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">
              🎬
            </div>

            <h2 className="text-xl font-semibold">
              No screens found
            </h2>

            <p className="text-slate-400 mt-2">
              Add a screen first from Screens & Seats.
            </p>
          </div>
        )}

        {/* NO SEATS */}
        {screens.length > 0 &&
          seats.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">
                💺
              </div>

              <h2 className="text-xl font-semibold">
                No active seats
              </h2>

              <p className="text-slate-400 mt-2">
                This screen does not have any active
                seats.
              </p>

              <p className="text-slate-500 mt-1">
                Add seats from Screens & Seats.
              </p>
            </div>
          )}

        {/* QR GRID */}
        {seats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3">
            {seats.map((seat) => {
              const qrUrl = getQrUrl(
                seat.seat_number
              );

              return (
                <div
                  key={seat.id}
                  className="qr-card bg-white text-black rounded-2xl p-6 shadow-xl"
                >
                  <div className="text-center">

                    <div className="text-sm font-medium text-gray-500">
                      {cinemaName}
                    </div>

                    <div className="text-sm font-medium text-gray-500 mt-1">
                      {selectedScreen?.name}
                    </div>

                    <div className="text-3xl font-bold mt-1 mb-5">
                      Seat {seat.seat_number}
                    </div>

                    <div className="flex justify-center mb-5">
                      <QRCodeSVG
                        id={`qr-${seat.id}`}
                        value={qrUrl}
                        size={220}
                        level="H"
                        includeMargin
                      />
                    </div>

                    <div className="text-xs text-gray-500 break-all mb-4">
                      {qrUrl}
                    </div>

                    <button
                      onClick={() =>
                        downloadQr(seat)
                      }
                      className="w-full bg-black text-white rounded-xl py-3 font-semibold hover:bg-gray-800"
                    >
                      Download SVG
                    </button>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          main {
            background: white !important;
            padding: 0 !important;
          }

          main > div {
            max-width: none !important;
          }

          main h1,
          main p,
          main select,
          main button,
          main label {
            display: none !important;
          }

          .qr-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #ddd;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </main>
  );
}