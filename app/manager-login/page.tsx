"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ManagerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      console.error(loginError);
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const role = userData.user?.app_metadata?.role;
    if (role === "manager") router.push("/admin");
    else if (role === "food_court") router.push("/food-court");
    else {
      await supabase.auth.signOut();
      setError("This account does not have staff access.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "13px 14px",
    borderRadius: 8, border: "1px solid #555", backgroundColor: "#101010",
    color: "#fff", WebkitTextFillColor: "#fff", caretColor: "#ff0038",
    marginTop: 8, fontSize: 16, outlineColor: "#ff0038",
  };

  return (
    <main className="seatbite-manager-login" style={{
      minHeight: "100vh", background: "#050505", color: "#fff", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      backgroundImage: "radial-gradient(ellipse at top, rgba(255,0,56,.16), transparent 48%)",
    }}>
      <section style={{
        width: "100%", maxWidth: 430, background: "#111", border: "1px solid #353535",
        borderTop: "4px solid #ff0038", borderRadius: 14, padding: "32px",
        boxSizing: "border-box", boxShadow: "0 24px 70px rgba(0,0,0,.5)",
      }}>
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 58, height: 58,
            borderRadius: 12, background: "#ff0038", color: "#fff", fontSize: 31, marginBottom: 14 }}>🍿</div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: "#ff0038", marginBottom: 8 }}>SEAT BITE</div>
          <h1 style={{ fontSize: 29, fontWeight: 800, margin: 0, color: "#fff" }}>Manager Login</h1>
          <p style={{ color: "#c5c5c5", marginTop: 9, lineHeight: 1.5 }}>Cinema food management portal</p>
        </header>
        {error && <div role="alert" style={{ background: "#351018", border: "1px solid #8b1932",
          color: "#ffb6c4", padding: 12, borderRadius: 8, marginBottom: 18 }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <label htmlFor="email" style={{ display: "block", marginBottom: 16, fontWeight: 700, color: "#fff" }}>
            Email / Gmail
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your Gmail" required autoComplete="email" style={fieldStyle} />
          </label>
          <label htmlFor="password" style={{ display: "block", marginBottom: 22, fontWeight: 700, color: "#fff" }}>
            Password
            <div style={{ position: "relative" }}>
              <input id="password" type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Enter password" required
                autoComplete="current-password" style={{ ...fieldStyle, paddingRight: 72 }} />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                style={{ position: "absolute", right: 9, top: 17, border: 0, background: "transparent",
                  color: "#ff7896", fontWeight: 800, cursor: "pointer", padding: 6 }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 8,
            border: "1px solid #ff0038", background: loading ? "#555" : "#ff0038", color: "#fff",
            fontSize: 16, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "SIGNING IN…" : "SIGN IN  →"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a href="/" style={{ color: "#d0d0d0", textDecoration: "none", fontSize: 14 }}>← Back to Customer Menu</a>
        </div>
      </section>
    </main>
  );
}
