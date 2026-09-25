"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Screen = {
  id: string;
  name: string;
  cinema_id: string;
};

type Seat = {
  id: string;
  seat_number: string;
  is_active: boolean;
  screen_id: string;
};

export default function ScreensSeatsPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);

  const [selectedScreenId, setSelectedScreenId] = useState("");

  const [screenName, setScreenName] = useState("");

  const [prefix, setPrefix] = useState("F");
  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("20");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedScreen = screens.find(
    (screen) => screen.id === selectedScreenId
  );

  // --------------------------------------------------
  // LOAD SCREENS
  // --------------------------------------------------
  async function loadScreens(selectFirst = false) {
    setError("");

    const { data, error: screensError } = await supabase
      .from("screens")
      .select("id, name, cinema_id")
      .order("name");

    if (screensError) {
      console.error("SCREEN LOAD ERROR:", screensError);
      setError("Failed to load screens.");
      setLoading(false);
      return;
    }

    const loadedScreens = (data || []) as Screen[];

    setScreens(loadedScreens);

    if (loadedScreens.length === 0) {
      setSelectedScreenId("");
      setSeats([]);
      setLoading(false);
      return;
    }

    if (
      selectFirst ||
      !selectedScreenId ||
      !loadedScreens.some((screen) => screen.id === selectedScreenId)
    ) {
      setSelectedScreenId(loadedScreens[0].id);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // LOAD SEATS
  // --------------------------------------------------
  async function loadSeats(screenId: string) {
    if (!screenId) {
      setSeats([]);
      return;
    }

    setError("");

    const { data, error: seatsError } = await supabase
      .from("seats")
      .select("id, seat_number, is_active, screen_id")
      .eq("screen_id", screenId)
      .order("seat_number");

    if (seatsError) {
      console.error("SEAT LOAD ERROR:", seatsError);
      setError("Failed to load seats.");
      return;
    }

    const loadedSeats = ((data || []) as Seat[]).sort((a, b) =>
      a.seat_number.localeCompare(b.seat_number, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

    setSeats(loadedSeats);
  }

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------
  useEffect(() => {
    loadScreens(true);
  }, []);

  // --------------------------------------------------
  // LOAD SEATS WHEN SCREEN CHANGES
  // --------------------------------------------------
  useEffect(() => {
    if (selectedScreenId) {
      loadSeats(selectedScreenId);
    } else {
      setSeats([]);
    }
  }, [selectedScreenId]);

  // --------------------------------------------------
  // ADD NEW SCREEN
  // --------------------------------------------------
  async function addScreen() {
    setMessage("");
    setError("");

    const name = screenName.trim();

    if (!name) {
      setError("Please enter a screen name.");
      return;
    }

    const duplicate = screens.some(
      (screen) => screen.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError("A screen with this name already exists.");
      return;
    }

    /*
     * Your screens table contains cinema_id.
     * We reuse the cinema_id from an existing screen.
     */
    const cinemaId = screens[0]?.cinema_id;

    if (!cinemaId) {
      setError(
        "No cinema_id was found. Please keep your existing Screen 1 first."
      );
      return;
    }

    setBusy(true);

    const { data, error: insertError } = await supabase
      .from("screens")
      .insert({
        name,
        cinema_id: cinemaId,
      })
      .select("id, name, cinema_id")
      .single();

    setBusy(false);

    if (insertError) {
      console.error("SCREEN INSERT ERROR:", insertError);
      setError(
  `Screen insert failed: ${insertError.message}${
    insertError.details ? ` — ${insertError.details}` : ""
  }`
);
      return;
    }

    setScreenName("");

    setMessage(`${name} was added successfully.`);

    if (data) {
      const newScreen = data as Screen;

      setScreens((current) =>
        [...current, newScreen].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        )
      );

      setSelectedScreenId(newScreen.id);
      setSeats([]);
    } else {
      await loadScreens();
    }
  }

  // --------------------------------------------------
  // DELETE SCREEN
  // --------------------------------------------------
  async function deleteScreen() {
    setMessage("");
    setError("");

    if (!selectedScreen) {
      setError("Please select a screen first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedScreen.name}?\n\nThis will also delete all seats belonging to this screen.\n\nOnly continue if this screen is permanently removed from the cinema.`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    /*
     * Delete seats first.
     * This avoids foreign-key problems if seats belong to the screen.
     */
    const { error: seatsDeleteError } = await supabase
      .from("seats")
      .delete()
      .eq("screen_id", selectedScreen.id);

    if (seatsDeleteError) {
      console.error("SEAT DELETE ERROR:", seatsDeleteError);
      setBusy(false);
      setError(
        "Could not delete the seats. Check your Supabase DELETE policy."
      );
      return;
    }

    const { error: screenDeleteError } = await supabase
      .from("screens")
      .delete()
      .eq("id", selectedScreen.id);

    setBusy(false);

    if (screenDeleteError) {
      console.error("SCREEN DELETE ERROR:", screenDeleteError);
      setError(
        "Could not delete the screen. Check your Supabase DELETE policy."
      );
      return;
    }

    const deletedName = selectedScreen.name;

    const remainingScreens = screens.filter(
      (screen) => screen.id !== selectedScreen.id
    );

    setScreens(remainingScreens);
    setSeats([]);

    if (remainingScreens.length > 0) {
      setSelectedScreenId(remainingScreens[0].id);
    } else {
      setSelectedScreenId("");
    }

    setMessage(`${deletedName} was deleted.`);
  }

  // --------------------------------------------------
  // ADD SEATS
  // --------------------------------------------------
  async function addSeats() {
    setMessage("");
    setError("");

    if (!selectedScreen) {
      setError("Please select a screen first.");
      return;
    }

    const cleanPrefix = prefix.trim().toUpperCase();

    const start = Number(startNumber);
    const end = Number(endNumber);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setError("Start and End must be whole numbers.");
      return;
    }

    if (start < 1 || end < 1) {
      setError("Seat numbers must be 1 or greater.");
      return;
    }

    if (end < start) {
      setError("End number must be greater than or equal to Start number.");
      return;
    }

    const count = end - start + 1;

    if (count > 200) {
      setError("You can add a maximum of 200 seats at one time.");
      return;
    }

    const existingSeatNumbers = new Set(
      seats.map((seat) => seat.seat_number.toUpperCase())
    );

    const newSeatNumbers: string[] = [];

    for (let number = start; number <= end; number++) {
      const seatNumber = `${cleanPrefix}${number}`;

      if (!existingSeatNumbers.has(seatNumber.toUpperCase())) {
        newSeatNumbers.push(seatNumber);
      }
    }

    if (newSeatNumbers.length === 0) {
      setError("All of those seats already exist.");
      return;
    }

    const rows = newSeatNumbers.map((seatNumber) => ({
      screen_id: selectedScreen.id,
      seat_number: seatNumber,
      is_active: true,
    }));

    setBusy(true);

    const { error: insertError } = await supabase
      .from("seats")
      .insert(rows);

    setBusy(false);

    if (insertError) {
      console.error("SEAT INSERT ERROR:", insertError);
      setError("Failed to add seats. Check your Supabase INSERT policy.");
      return;
    }

    setMessage(
      `${newSeatNumbers.length} seat${
        newSeatNumbers.length === 1 ? "" : "s"
      } added successfully.`
    );

    await loadSeats(selectedScreen.id);
  }

  // --------------------------------------------------
  // ACTIVATE / DEACTIVATE SEAT
  // --------------------------------------------------
  async function toggleSeat(seat: Seat) {
    setMessage("");
    setError("");

    const newStatus = !seat.is_active;

    setBusy(true);

    const { error: updateError } = await supabase
      .from("seats")
      .update({
        is_active: newStatus,
      })
      .eq("id", seat.id);

    setBusy(false);

    if (updateError) {
      console.error("SEAT UPDATE ERROR:", updateError);

      setError(
        "Seat update failed. Make sure the Supabase UPDATE policy allows this operation."
      );

      return;
    }

    setMessage(
      `${seat.seat_number} is now ${
        newStatus ? "active" : "deactivated"
      }.`
    );

    await loadSeats(seat.screen_id);
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------
  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#111",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading screens...
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        padding: "40px 20px 80px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 36,
                margin: 0,
              }}
            >
              🎬 Screens & Seats
            </h1>

            <p
              style={{
                color: "#aaa",
                marginTop: 8,
                marginBottom: 0,
              }}
            >
              Add screens and manage cinema seats.
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              color: "#fff",
              textDecoration: "none",
              background: "#222",
              border: "1px solid #444",
              padding: "12px 18px",
              borderRadius: 8,
            }}
          >
            ← Admin Dashboard
          </Link>
        </div>

        {/* MESSAGE */}
        {message && (
          <div
            style={{
              background: "#064e26",
              border: "1px solid #16803c",
              color: "#b7ffd0",
              padding: 14,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            ✅ {message}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#4a1111",
              border: "1px solid #a52a2a",
              color: "#ffbaba",
              padding: 14,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* ADD SCREEN */}
        <section
          style={{
            background: "#1b1b1b",
            border: "1px solid #333",
            borderRadius: 12,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            ＋ Add New Screen
          </h2>

          <p
            style={{
              color: "#aaa",
              marginTop: 0,
              marginBottom: 15,
            }}
          >
            Example: Screen 2, Screen 3, Screen 4
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
              placeholder="Screen 2"
              style={{
                flex: 1,
                minWidth: 250,
                background: "#111",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 8,
                padding: 14,
                fontSize: 16,
              }}
            />

            <button
              onClick={addScreen}
              disabled={busy}
              style={{
                background: "#fff",
                color: "#111",
                border: "none",
                borderRadius: 8,
                padding: "14px 25px",
                fontWeight: "bold",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Please wait..." : "Add Screen"}
            </button>
          </div>
        </section>

        {/* SCREEN SELECTOR */}
        <section
          style={{
            background: "#1b1b1b",
            border: "1px solid #333",
            borderRadius: 12,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              marginTop: 0,
              marginBottom: 12,
            }}
          >
            🎥 Select Screen
          </h2>

          {screens.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No screens available. Add a screen above.
            </p>
          ) : (
            <>
              <select
                value={selectedScreenId}
                onChange={(e) => setSelectedScreenId(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 450,
                  background: "#111",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 16,
                }}
              >
                {screens.map((screen) => (
                  <option key={screen.id} value={screen.id}>
                    {screen.name}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 16 }}>
                <button
                  onClick={deleteScreen}
                  disabled={busy}
                  style={{
                    background: "#3a1010",
                    color: "#ff7777",
                    border: "1px solid #a52a2a",
                    borderRadius: 8,
                    padding: "12px 18px",
                    fontWeight: "bold",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  🗑 Delete Selected Screen
                </button>

                <p
                  style={{
                    color: "#777",
                    fontSize: 13,
                    marginTop: 10,
                  }}
                >
                  Deleting a screen also deletes its seats. Use this only when
                  the screen is permanently removed.
                </p>
              </div>
            </>
          )}
        </section>

        {/* ADD SEATS */}
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
            <h2
              style={{
                fontSize: 20,
                marginTop: 0,
                marginBottom: 8,
              }}
            >
              ＋ Add Seats to {selectedScreen.name}
            </h2>

            <p
              style={{
                color: "#aaa",
                marginTop: 0,
                marginBottom: 15,
              }}
            >
              Example: prefix F, start 1, end 20 creates F1, F2, F3 ... F20.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    color: "#aaa",
                    marginBottom: 6,
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
                    background: "#111",
                    color: "#fff",
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 16,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#aaa",
                    marginBottom: 6,
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
                    background: "#111",
                    color: "#fff",
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 16,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#aaa",
                    marginBottom: 6,
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
                    background: "#111",
                    color: "#fff",
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 16,
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
                  disabled={busy}
                  style={{
                    width: "100%",
                    background: "#fff",
                    color: "#111",
                    border: "none",
                    borderRadius: 8,
                    padding: 14,
                    fontWeight: "bold",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Please wait..." : "Add Seats"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SEATS */}
        {selectedScreen && (
          <section
            style={{
              background: "#1b1b1b",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                marginTop: 0,
                marginBottom: 8,
              }}
            >
              💺 {selectedScreen.name} Seats
            </h2>

            <p
              style={{
                color: "#aaa",
                marginTop: 0,
                marginBottom: 20,
              }}
            >
              {seats.filter((seat) => seat.is_active).length} active
              {" • "}
              {seats.filter((seat) => !seat.is_active).length} inactive
              {" • "}
              {seats.length} total
            </p>

            {seats.length === 0 ? (
              <p style={{ color: "#aaa" }}>
                No seats added yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(145px, 1fr))",
                  gap: 10,
                }}
              >
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    style={{
                      background: "#222",
                      border: "1px solid #444",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: "bold",
                        marginBottom: 8,
                      }}
                    >
                      💺 {seat.seat_number}
                    </div>

                    <div
                      style={{
                        color: seat.is_active ? "#39ff88" : "#ff7777",
                        fontSize: 13,
                        fontWeight: "bold",
                        marginBottom: 10,
                      }}
                    >
                      {seat.is_active ? "ACTIVE" : "INACTIVE"}
                    </div>

                    <button
                      onClick={() => toggleSeat(seat)}
                      disabled={busy}
                      style={{
                        width: "100%",
                        background: "transparent",
                        color: seat.is_active ? "#fff" : "#39ff88",
                        border: `1px solid ${
                          seat.is_active ? "#555" : "#16803c"
                        }`,
                        borderRadius: 6,
                        padding: "8px 5px",
                        cursor: busy ? "not-allowed" : "pointer",
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