"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Cinema = {
  id: string;
  name: string;
  created_at: string;
};

type AccountForm = {
  managerEmail: string;
  managerPassword: string;
  foodCourtEmail: string;
  foodCourtPassword: string;
};

export default function MasterAdminPage() {
  const supabase = createClient();

  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [cinemaName, setCinemaName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const [openCinemaId, setOpenCinemaId] = useState<string | null>(null);

  const [accountForms, setAccountForms] = useState<
    Record<string, AccountForm>
  >({});

  const [savingAccounts, setSavingAccounts] = useState<
    Record<string, boolean>
  >({});

  async function loadCinemas() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("cinemas")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setCinemas(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCinemas();
  }, []);

  async function addCinema() {
    const name = cinemaName.trim();

    if (!name) {
      alert("Please enter a cinema name.");
      return;
    }

    setAdding(true);
    setError("");

    const { error } = await supabase.from("cinemas").insert({
      name,
    });

    if (error) {
      setError(error.message);
      alert("Failed to add cinema: " + error.message);
    } else {
      setCinemaName("");
      await loadCinemas();
      alert("Cinema added successfully.");
    }

    setAdding(false);
  }

  async function editCinema(cinema: Cinema) {
    const newName = window.prompt(
      "Enter the new cinema name:",
      cinema.name
    );

    if (newName === null) {
      return;
    }

    const trimmedName = newName.trim();

    if (!trimmedName) {
      alert("Cinema name cannot be empty.");
      return;
    }

    if (trimmedName === cinema.name) {
      return;
    }

    const { error } = await supabase
      .from("cinemas")
      .update({ name: trimmedName })
      .eq("id", cinema.id);

    if (error) {
      console.error(error);
      alert("Failed to update cinema: " + error.message);
      return;
    }

    await loadCinemas();
    alert("Cinema updated successfully.");
  }

  async function deleteCinema(cinema: Cinema) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${cinema.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("cinemas")
      .delete()
      .eq("id", cinema.id);

    if (error) {
      console.error(error);
      alert("Failed to delete cinema: " + error.message);
      return;
    }

    await loadCinemas();

    setOpenCinemaId(null);

    alert("Cinema deleted successfully.");
  }

  function createSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 25);
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";

    let password = "";

    for (let i = 0; i < 12; i++) {
      password += chars.charAt(
        Math.floor(Math.random() * chars.length)
      );
    }

    return password;
  }

  async function openAccountEditor(cinema: Cinema) {
    if (openCinemaId === cinema.id) {
      setOpenCinemaId(null);
      return;
    }

    setError("");
    setOpenCinemaId(cinema.id);
    setAccountForms((current) => ({
      ...current,
      [cinema.id]: {
        managerEmail: current[cinema.id]?.managerEmail || "",
        managerPassword: "",
        foodCourtEmail: current[cinema.id]?.foodCourtEmail || "",
        foodCourtPassword: "",
      },
    }));

    try {
      const response = await fetch(
        `/api/master-admin/accounts?cinemaId=${encodeURIComponent(cinema.id)}`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load saved account details.");
      }

      setAccountForms((current) => ({
        ...current,
        [cinema.id]: {
          managerEmail: result.accounts?.manager?.email || current[cinema.id]?.managerEmail || "",
          managerPassword: "",
          foodCourtEmail: result.accounts?.food_court?.email || current[cinema.id]?.foodCourtEmail || "",
          foodCourtPassword: "",
        },
      }));
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Could not load account details.");
    }
  }

  function updateAccountField(
    cinemaId: string,
    field: keyof AccountForm,
    value: string
  ) {
    setAccountForms((current) => ({
      ...current,
      [cinemaId]: {
        ...current[cinemaId],
        [field]: value,
      },
    }));
  }

  async function resetAccountPassword(cinema: Cinema, role: "manager" | "food_court") {
    const form = accountForms[cinema.id];
    if (!form) {
      alert("Open the Accounts section first.");
      return;
    }

    const email = role === "manager" ? form.managerEmail.trim() : form.foodCourtEmail.trim();
    if (!email) {
      alert("Please enter the account email first.");
      return;
    }

    const label = role === "manager" ? "Manager" : "Food Court";
    if (!window.confirm(`Reset the ${label} password for ${cinema.name}? The previous password will stop working.`)) return;

    const newPassword = generatePassword();
    setSavingAccounts((current) => ({ ...current, [cinema.id]: true }));
    try {
      const response = await fetch("/api/master-admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cinemaId: cinema.id,
          managerEmail: form.managerEmail.trim(),
          managerPassword: role === "manager" ? newPassword : "",
          foodCourtEmail: form.foodCourtEmail.trim(),
          foodCourtPassword: role === "food_court" ? newPassword : "",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Password reset failed.");

      setAccountForms((current) => ({
        ...current,
        [cinema.id]: {
          ...current[cinema.id],
          managerPassword: role === "manager" ? newPassword : "",
          foodCourtPassword: role === "food_court" ? newPassword : "",
        },
      }));

      window.prompt(`${label} password reset successfully. Copy the new password now:`, newPassword);
    } catch (error) {
      alert("Could not reset password: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setSavingAccounts((current) => ({ ...current, [cinema.id]: false }));
    }
  }

  async function saveAccounts(cinema: Cinema) {
    const form = accountForms[cinema.id];

    if (!form) {
      alert("Please open the account editor first.");
      return;
    }

    if (!form.managerEmail.trim() || !form.foodCourtEmail.trim()) {
      alert("Please enter both the Manager and Food Court login emails.");
      return;
    }

    if (form.managerPassword && form.managerPassword.length < 6) {
      alert("Manager password must be at least 6 characters, or leave it blank to keep the current password.");
      return;
    }

    if (form.foodCourtPassword && form.foodCourtPassword.length < 6) {
      alert("Food Court password must be at least 6 characters, or leave it blank to keep the current password.");
      return;
    }

    setSavingAccounts((current) => ({
      ...current,
      [cinema.id]: true,
    }));

    try {
      const response = await fetch("/api/master-admin/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cinemaId: cinema.id,
          managerEmail: form.managerEmail.trim(),
          managerPassword: form.managerPassword,
          foodCourtEmail: form.foodCourtEmail.trim(),
          foodCourtPassword: form.foodCourtPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to create accounts."
        );
      }

      alert(
        `Accounts saved successfully for ${cinema.name}.\n\n` +
          `Manager Login: ${form.managerEmail}\n` +
          `Manager Password: ${form.managerPassword}\n\n` +
          `Food Court Login: ${form.foodCourtEmail}\n` +
          `Food Court Password: ${form.foodCourtPassword}`
      );
    } catch (error) {
      console.error(error);

      alert(
        "Failed to save accounts: " +
          (error instanceof Error
            ? error.message
            : "Unknown error")
      );
    } finally {
      setSavingAccounts((current) => ({
        ...current,
        [cinema.id]: false,
      }));
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: "#111",
            color: "white",
            padding: "28px",
            borderRadius: "16px",
            marginBottom: "25px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "30px" }}>
            🛡️ Master Admin
          </h1>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#ccc",
            }}
          >
            Manage cinemas, managers and food court staff
          </p>
        </div>

        {/* ADD CINEMA */}
        <section
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "16px",
            marginBottom: "25px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>🏢 Add New Cinema</h2>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Cinema name"
              value={cinemaName}
              onChange={(e) => setCinemaName(e.target.value)}
              style={{
                flex: 1,
                minWidth: "250px",
                padding: "13px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                fontSize: "16px",
              }}
            />

            <button
              onClick={addCinema}
              disabled={adding}
              style={{
                padding: "13px 22px",
                border: "none",
                borderRadius: "8px",
                background: adding ? "#999" : "#111",
                color: "white",
                fontWeight: "bold",
                cursor: adding ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "Adding..." : "+ Add Cinema"}
            </button>
          </div>

          {error && (
            <p
              style={{
                marginTop: "15px",
                color: "red",
                background: "#fff0f0",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              {error}
            </p>
          )}
        </section>

        {/* CINEMA LIST */}
        <section
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            🏢 Your Cinemas
          </h2>

          {loading ? (
            <p>Loading cinemas...</p>
          ) : cinemas.length === 0 ? (
            <p style={{ color: "#777" }}>
              No cinemas found.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "15px",
              }}
            >
              {cinemas.map((cinema, index) => {
                const form = accountForms[cinema.id];
                const isOpen = openCinemaId === cinema.id;
                const isSaving = savingAccounts[cinema.id];

                return (
                  <div
                    key={cinema.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "12px",
                      padding: "18px",
                    }}
                  >
                    {/* CINEMA HEADER */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "15px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "bold",
                          }}
                        >
                          {index + 1}. {cinema.name}
                        </div>

                        <div
                          style={{
                            fontSize: "12px",
                            color: "#888",
                            marginTop: "5px",
                          }}
                        >
                          Cinema ID: {cinema.id}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            padding: "7px 12px",
                            background: "#e8f5e9",
                            color: "#2e7d32",
                            borderRadius: "20px",
                            fontSize: "13px",
                            fontWeight: "bold",
                          }}
                        >
                          ACTIVE
                        </div>

                        <button
                          onClick={() => editCinema(cinema)}
                          style={{
                            padding: "9px 14px",
                            border: "none",
                            borderRadius: "8px",
                            background: "#1976d2",
                            color: "white",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          ✏️ Rename
                        </button>

                        <button
                          onClick={() =>
                            openAccountEditor(cinema)
                          }
                          style={{
                            padding: "9px 14px",
                            border: "none",
                            borderRadius: "8px",
                            background: "#6a1b9a",
                            color: "white",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          👤 Accounts
                        </button>

                        <button
                          onClick={() => deleteCinema(cinema)}
                          style={{
                            padding: "9px 14px",
                            border: "none",
                            borderRadius: "8px",
                            background: "#d32f2f",
                            color: "white",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* ACCOUNT EDITOR */}
                    {isOpen && form && (
                      <div
                        style={{
                          marginTop: "20px",
                          padding: "20px",
                          background: "#f8f8f8",
                          borderRadius: "12px",
                          border: "1px solid #ddd",
                        }}
                      >
                        <h3 style={{ marginTop: 0 }}>
                          🔐 Login Accounts — {cinema.name}
                        </h3>

                        {/* MANAGER */}
                        <div
                          style={{
                            background: "white",
                            padding: "16px",
                            borderRadius: "10px",
                            marginBottom: "15px",
                            border: "1px solid #ddd",
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>
                            👨‍💼 Manager Account
                          </h4>

                          <label
                            style={{
                              display: "block",
                              fontWeight: "bold",
                              marginBottom: "6px",
                            }}
                          >
                            Manager Login ID / Email
                          </label>

                          <input
                            type="email"
                            value={form.managerEmail}
                            onChange={(e) =>
                              updateAccountField(
                                cinema.id,
                                "managerEmail",
                                e.target.value
                              )
                            }
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "11px",
                              border: "1px solid #ccc",
                              borderRadius: "7px",
                              marginBottom: "12px",
                            }}
                          />

                          <label
                            style={{
                              display: "block",
                              fontWeight: "bold",
                              marginBottom: "6px",
                            }}
                          >
                            Manager Password
                          </label>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                            }}
                          >
                            <input
                              type="text"
                              value={form.managerPassword}
                              onChange={(e) =>
                                updateAccountField(
                                  cinema.id,
                                  "managerPassword",
                                  e.target.value
                                )
                              }
                              style={{
                                flex: 1,
                                padding: "11px",
                                border: "1px solid #ccc",
                                borderRadius: "7px",
                              }}
                            />

                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => resetAccountPassword(cinema, "manager")}
                              style={{
                                padding: "10px 14px",
                                border: "none",
                                borderRadius: "7px",
                                background: "#c62828",
                                color: "white",
                                cursor: isSaving ? "not-allowed" : "pointer",
                              }}
                            >
                              Reset & Save
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateAccountField(
                                  cinema.id,
                                  "managerPassword",
                                  generatePassword()
                                )
                              }
                              style={{
                                padding: "10px 14px",
                                border: "none",
                                borderRadius: "7px",
                                background: "#555",
                                color: "white",
                                cursor: "pointer",
                              }}
                            >
                              Generate
                            </button>
                          </div>
                        </div>

                        {/* FOOD COURT */}
                        <div
                          style={{
                            background: "white",
                            padding: "16px",
                            borderRadius: "10px",
                            marginBottom: "15px",
                            border: "1px solid #ddd",
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>
                            🍿 Food Court Account
                          </h4>

                          <label
                            style={{
                              display: "block",
                              fontWeight: "bold",
                              marginBottom: "6px",
                            }}
                          >
                            Food Court Login ID / Email
                          </label>

                          <input
                            type="email"
                            value={form.foodCourtEmail}
                            onChange={(e) =>
                              updateAccountField(
                                cinema.id,
                                "foodCourtEmail",
                                e.target.value
                              )
                            }
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "11px",
                              border: "1px solid #ccc",
                              borderRadius: "7px",
                              marginBottom: "12px",
                            }}
                          />

                          <label
                            style={{
                              display: "block",
                              fontWeight: "bold",
                              marginBottom: "6px",
                            }}
                          >
                            Food Court Password
                          </label>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                            }}
                          >
                            <input
                              type="text"
                              value={form.foodCourtPassword}
                              onChange={(e) =>
                                updateAccountField(
                                  cinema.id,
                                  "foodCourtPassword",
                                  e.target.value
                                )
                              }
                              style={{
                                flex: 1,
                                padding: "11px",
                                border: "1px solid #ccc",
                                borderRadius: "7px",
                              }}
                            />

                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => resetAccountPassword(cinema, "food_court")}
                              style={{
                                padding: "10px 14px",
                                border: "none",
                                borderRadius: "7px",
                                background: "#c62828",
                                color: "white",
                                cursor: isSaving ? "not-allowed" : "pointer",
                              }}
                            >
                              Reset & Save
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateAccountField(
                                  cinema.id,
                                  "foodCourtPassword",
                                  generatePassword()
                                )
                              }
                              style={{
                                padding: "10px 14px",
                                border: "none",
                                borderRadius: "7px",
                                background: "#555",
                                color: "white",
                                cursor: "pointer",
                              }}
                            >
                              Generate
                            </button>
                          </div>
                        </div>

                        {/* SAVE */}
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => saveAccounts(cinema)}
                            disabled={isSaving}
                            style={{
                              padding: "12px 20px",
                              border: "none",
                              borderRadius: "8px",
                              background: isSaving
                                ? "#999"
                                : "#2e7d32",
                              color: "white",
                              fontWeight: "bold",
                              cursor: isSaving
                                ? "not-allowed"
                                : "pointer",
                            }}
                          >
                            {isSaving
                              ? "Saving..."
                              : "💾 Save Login Accounts"}
                          </button>

                          <button
                            onClick={() =>
                              setOpenCinemaId(null)
                            }
                            style={{
                              padding: "12px 20px",
                              border: "1px solid #aaa",
                              borderRadius: "8px",
                              background: "white",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}