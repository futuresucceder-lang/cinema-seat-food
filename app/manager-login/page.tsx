"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ManagerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
  console.error(loginError);
  setError("Invalid email or password.");
  setLoading(false);
  return;
}

const { data: userData } = await supabase.auth.getUser();

const role = userData.user?.app_metadata?.role;

if (role === "manager") {
  router.push("/admin");
} else if (role === "food_court") {
  router.push("/food-court");
} else {
  await supabase.auth.signOut();
  setError("This account does not have staff access.");
  setLoading(false);
  return;
}

router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#1b1b1b",
          border: "1px solid #333",
          borderRadius: "16px",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              marginBottom: "10px",
            }}
          >
            🎬
          </div>

          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: 0,
            }}
          >
            Manager Login
          </h1>

          <p
            style={{
              color: "#aaa",
              marginTop: "8px",
            }}
          >
            Cinema Food Management
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#3a1717",
              border: "1px solid #7a2929",
              color: "#ff8c8c",
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
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your Gmail"
            required
            autoComplete="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px",
              borderRadius: "8px",
              border: "1px solid #444",
              background: "#111",
              color: "white",
              marginBottom: "18px",
              fontSize: "16px",
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            }}
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px",
              borderRadius: "8px",
              border: "1px solid #444",
              background: "#111",
              color: "white",
              marginBottom: "22px",
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
              color: "white",
              fontSize: "16px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "🔐 SIGN IN"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "24px",
          }}
        >
          <a
            href="/"
            style={{
              color: "#aaa",
              textDecoration: "none",
            }}
          >
            ← Back to Customer Menu
          </a>
        </div>
      </div>
    </main>
  );
}
