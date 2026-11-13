"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FoodCourtLoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const supabase = createClient();
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (loginError || !data.user) {
      setError(loginError?.message || "Login failed. Please check your details.");
      setLoading(false); return;
    }
    const role = data.user.app_metadata?.role ?? data.user.user_metadata?.role;
    const allowed = role === "food_court";
    if (!allowed) {
      await supabase.auth.signOut();
      setError("This account does not have Food Court access. Please use the correct login.");
      setLoading(false); return;
    }
    router.push("/food-court");
    router.refresh();
  }

  return (
    <main className="sb-auth-page">
      <section className="sb-auth-visual">
        <a className="sb-auth-home-link" href="/">← Back to home</a>
        <div className="sb-auth-copy">
          <p className="sb-auth-eyebrow">SEATBITE OPERATIONS</p>
          <h1>Run venue<br />service<br />with clear<br />control.</h1>
          <p>Receive customer orders and manage food preparation and delivery for your assigned cinema.</p>
          <div className="sb-auth-role-note"><strong>Food Court</strong><span>Sign in with your Food Court staff account.</span></div>
        </div>
      </section>
      <section className="sb-auth-form-side">
        <img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="sb-auth-logo" />
        <div className="sb-auth-card">
          <p className="sb-auth-kicker">FOOD COURT ACCESS</p>
          <h2>Food Court Login</h2>
          <p className="sb-auth-subtitle">Sign in with your Food Court staff account.</p>
          {error && <div className="sb-auth-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <label className="sb-auth-field" htmlFor="food-court-email">
              <span>Email address</span>
              <input className="sb-auth-input" id="food-court-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" autoComplete="username" required />
            </label>
            <label className="sb-auth-field" htmlFor="food-court-password">
              <span>Password</span>
              <div className="sb-auth-input-wrap">
                <input className="sb-auth-input sb-auth-password" id="food-court-password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                <button type="button" className="sb-auth-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "HIDE" : "SHOW"}</button>
              </div>
            </label>
            <button className="sb-auth-submit" type="submit" disabled={loading}>{loading ? "SIGNING IN…" : "SIGN IN  →"}</button>
          </form>
          <a href="/" className="sb-auth-back">← Back to SeatBite Home</a>
        </div>
      </section>
    </main>
  );
}
