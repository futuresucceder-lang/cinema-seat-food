"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MasterLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("admin@cinema.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Login failed. User not found.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      await supabase.auth.signOut();
      setError("Could not verify your account role.");
      setLoading(false);
      return;
    }

    if (profile?.role !== "master_admin") {
      await supabase.auth.signOut();
      setError("This account does not have Master Admin access.");
      setLoading(false);
      return;
    }

    router.push("/master-admin");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#1c1c1c",
          border: "1px solid #333",
          borderRadius: "16px",
          padding: "32px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "48px" }}>🛡️</div>

          <h1
            style={{
              fontSize: "30px",
              fontWeight: 700,
              margin: "10px 0",
            }}
          >
            Master Admin
          </h1>

          <p style={{ color: "#aaa", margin: 0 }}>
            Cinema Management System
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#4a1717",
              border: "1px solid #8b3030",
              color: "#ff8f8f",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#111",
              color: "#fff",
              marginBottom: "18px",
              fontSize: "16px",
            }}
          />

          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#111",
              color: "#fff",
              marginBottom: "20px",
              fontSize: "16px",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "8px",
              border: "none",
              background: loading ? "#555" : "#e50914",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing In..." : "🔐 SIGN IN"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            marginTop: "20px",
            padding: "10px",
            background: "transparent",
            border: "none",
            color: "#aaa",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          ← Back to Customer Menu
        </button>
      </div>
    </main>
  );
}