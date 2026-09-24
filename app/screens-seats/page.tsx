"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Screen = {
  id: string;
  name: string;
};

type Seat = {
  id: string;
  seat_number: string;
  is_active: boolean;
};

export default function ScreensSeatsPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState("");

  const [screenName, setScreenName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("20");

  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [addingScreen, setAddingScreen] = useState(false);
  const [addingSeats, setAddingSeats] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadScreens() {
    setLoadingScreens(true);
    setError("");

    const { data, error: screenError } = await supabase
      .from("screens")
      .select("id, name")
      .order("name");

    if (screenError) {
      setError("Failed to load screens.");
      setLoadingScreens(false);
      return;
    }

    const screenList = (data ?? []) as Screen[];
    setScreens(screenList);

    if (!selectedScreenId && screenList.length > 0) {
      setSelectedScreenId(screenList[0].id);
    }

    setLoadingScreens(false);
  }

  async function loadSeats(screenId: string) {
    if (!screenId) {
      setSeats([]);
      return;
    }

    setLoadingSeats(true);
    setError("");

    const { data, error: seatError } = await supabase
      .from("seats")
      .select("id, seat_number, is_active")
      .eq("screen_id", screenId);

    if (seatError) {
      setError("Failed to load seats.");
      setLoadingSeats(false);
      return;
    }

    const seatList = (data ?? []) as Seat[];

    seatList.sort((a, b) =>
      a.seat_number.localeCompare(b.seat_number, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

    setSeats(seatList);
    setLoadingSeats(false);
  }

  useEffect(() => {
    loadScreens();
  }, []);

  useEffect(() => {
    if (selectedScreenId) {
      loadSeats(selectedScreenId);
    }
  }, [selectedScreenId]);

  async function addScreen() {
    setMessage("");
    setError("");

    const name = screenName.trim();

    if (!name) {
      setError("Enter a screen name.");
      return;
    }

    const alreadyExists = screens.some(
      (screen) => screen.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      setError("A screen with this name already exists.");
      return;
    }

    setAddingScreen(true);

    const { error: insertError } = await supabase
      .from("screens")
      .insert({
        name,
      });

    if (insertError) {
      setError(
        "Could not add the screen. Check your Supabase permissions."
      );
      setAddingScreen(false);
      return;
    }

    setScreenName("");
    setMessage(`${name} added successfully.`);

    await loadScreens();

    setAddingScreen(false);
  }

  async function addSeats() {
    setMessage("");
    setError("");

    if (!selectedScreenId) {
      setError("Select a screen first.");
      return;
    }

    const start = Number(startNumber);
    const end = Number(endNumber);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start
    ) {
      setError("Enter a valid seat number range.");
      return;
    }

    if (end - start + 1 > 500) {
      setError("You can add a maximum of 500 seats at once.");
      return;
    }

    setAddingSeats(true);

    const selectedScreen = screens.find(
      (screen) => screen.id === selectedScreenId
    );

    if (!selectedScreen) {
      setError("Selected screen was not found.");
      setAddingSeats(false);
      return;
    }

    const cleanPrefix = prefix.trim().toUpperCase();

    const requestedSeats: string[] = [];

    for (let number = start; number <= end; number++) {
      requestedSeats.push(`${cleanPrefix}${number}`);
    }

    const existingSeatNumbers = new Set(
      seats.map((seat) => seat.seat_number.toUpperCase())
    );

    const newSeatNumbers = requestedSeats.filter(
      (seatNumber) => !existingSeatNumbers.has(seatNumber.toUpperCase())
    );

    if (newSeatNumbers.length === 0) {
      setError("All of those seats already exist on this screen.");
      setAddingSeats(false);
      return;
    }

    const rows = newSeatNumbers.map((seatNumber) => ({
      screen_id: selectedScreenId,
      seat_number: seatNumber,
      is_active: true,
    }));

    const { error: insertError } = await supabase
      .from("seats")
      .insert(rows);

    if (insertError) {
      setError(
        "Could not add seats. Check your Supabase permissions and table structure."
      );
      setAddingSeats(false);
      return;
    }

    setPrefix("");
    setMessage(
      `${newSeatNumbers.length} seat(s) added to ${selectedScreen.name}.`
    );

    await loadSeats(selectedScreenId);

    setAddingSeats(false);
  }

  async function toggleSeat(seat: Seat) {
    setMessage("");
    setError("");

    const newStatus = !seat.is_active;

    const { error: updateError } = await supabase
      .from("seats")
      .update({
        is_active: newStatus,
      })
      .eq("id", seat.id);

    if (updateError) {
      setError("Could not update this seat.");
      return;
    }

    setSeats((current) =>
      current.map((item) =>
        item.id === seat.id
          ? { ...item, is_active: newStatus }
          : item
      )
    );

    setMessage(
      `${seat.seat_number} is now ${
        newStatus ? "active" : "inactive"
      }.`
    );
  }

  const selectedScreen = screens.find(
    (screen) => screen.id === selectedScreenId
  );

  const activeSeats = useMemo(
    () => seats.filter((seat) => seat.is_active),
    [seats]
  );

  const inactiveSeats = useMemo(
    () => seats.filter((seat) => !seat.is_active),
    [seats]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        padding: "30px 20px 60px",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            marginBottom: 30,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 32 }}>
              🎬 Screens & Seats
            </h1>

            <p style={{ color: "#aaa", marginTop: 8 }}>
              Add cinema screens and manage their seats.
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              background: "#222",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid #444",
            }}
          >
            ← Admin Dashboard
          </Link>
        </div>

        {/* Messages */}
        {message && (
          <div
            style={{
              background: "#143d24",
              border: "1px solid #267342",
              padding: 14,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            ✅ {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#421919",
              border: "1px solid #813333",
              padding: 14,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Add Screen */}
        <section
          style={{
            background: "#1b1b1b",
            border: "1px solid #333",
            borderRadius: 12,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>➕ Add New Screen</h2>

          <p style={{ color: "#aaa" }}>
            Example: Screen 4, Screen 5, Screen 6.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="Screen 4"
              style={{
                flex: 1,
                minWidth: 220,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #444",
                background: "#111",
                color: "#fff",
              }}
            />

            <button
              onClick={addScreen}
              disabled={addingScreen}
              style={{
                padding: "12px 20px",
                borderRadius: 8,
                border: "none",
                background: "#fff",
                color: "#111",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {addingScreen ? "Adding..." : "Add Screen"}
            </button>
          </div>
        </section>

        {/* Screen Selector */}
        <section
          style={{
            background: "#1b1b1b",
            border: "1px solid #333",
            borderRadius: 12,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>🎥 Select Screen</h2>

          {loadingScreens ? (
            <p style={{ color: "#aaa" }}>Loading screens...</p>
          ) : screens.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No screens exist yet. Add your first screen above.
            </p>
          ) : (
            <select
              value={selectedScreenId}
              onChange={(e) => setSelectedScreenId(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 400,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #444",
                background: "#111",
                color: "#fff",
              }}
            >
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* Add Seats */}
        {selectedScreen && (
          <section
            style={{
              background: "#1b1b1b",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 22,
              marginBottom: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              ➕ Add Seats to {selectedScreen.name}
            </h2>

            <p style={{ color: "#aaa" }}>
              For example, prefix <strong>F</strong>, start{" "}
              <strong>1</strong>, end <strong>20</strong> creates:
              F1, F2, F3 ... F20.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    color: "#aaa",
                  }}
                >
                  Prefix
                </label>

                <input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="F"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #444",
                    background: "#111",
                    color: "#fff",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    color: "#aaa",
                  }}
                >
                  Start
                </label>

                <input
                  type="number"
                  min="1"
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #444",
                    background: "#111",
                    color: "#fff",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    color: "#aaa",
                  }}
                >
                  End
                </label>

                <input
                  type="number"
                  min="1"
                  value={endNumber}
                  onChange={(e) => setEndNumber(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #444",
                    background: "#111",
                    color: "#fff",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "end",
                }}
              >
                <button
                  onClick={addSeats}
                  disabled={addingSeats}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {addingSeats ? "Adding..." : "Add Seats"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Seat List */}
        {selectedScreen && (
          <section
            style={{
              background: "#1b1b1b",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 15,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  💺 {selectedScreen.name} Seats
                </h2>

                <p style={{ color: "#aaa" }}>
                  {activeSeats.length} active ·{" "}
                  {inactiveSeats.length} inactive ·{" "}
                  {seats.length} total
                </p>
              </div>
            </div>

            {loadingSeats ? (
              <p style={{ color: "#aaa" }}>Loading seats...</p>
            ) : seats.length === 0 ? (
              <p style={{ color: "#aaa" }}>
                No seats have been added to this screen yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    style={{
                      background: seat.is_active ? "#222" : "#171717",
                      border: `1px solid ${
                        seat.is_active ? "#444" : "#333"
                      }`,
                      borderRadius: 8,
                      padding: 12,
                      opacity: seat.is_active ? 1 : 0.55,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 18,
                        marginBottom: 8,
                      }}
                    >
                      💺 {seat.seat_number}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: seat.is_active ? "#7ee787" : "#aaa",
                        marginBottom: 10,
                      }}
                    >
                      {seat.is_active ? "ACTIVE" : "INACTIVE"}
                    </div>

                    <button
                      onClick={() => toggleSeat(seat)}
                      style={{
                        width: "100%",
                        padding: "7px 8px",
                        borderRadius: 6,
                        border: "1px solid #555",
                        background: "#111",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      {seat.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}