"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ManagerLoginPage() {
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
    const allowed = role === "manager";
    if (!allowed) {
      await supabase.auth.signOut();
      setError("This account does not have Manager access. Please use the correct login.");
      setLoading(false); return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="sb-auth-page">
      <section className="sb-auth-visual">
        <img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="sb-auth-logo" />
        <div className="sb-auth-copy">
          <p className="sb-auth-eyebrow">SEATBITE · VENUE OPERATIONS</p>
          <h1>Run venue service<br />with clear control.</h1>
          <p>One connected platform for cinema teams. Keep service smooth, coordinate every order and let guests enjoy the show.</p>
        </div>
        <div className="sb-auth-visual-foot">ORDER · WATCH · ENJOY &nbsp; / &nbsp; MANAGER</div>
      </section>
      <section className="sb-auth-form-side">
        <div className="sb-auth-card">
          <div className="sb-auth-card-brand"><span className="sb-auth-brand-icon">▣</span><span className="sb-auth-brand-text">SeatBite</span></div>
          <p className="sb-auth-kicker">STAFF ACCESS</p>
          <h2>Manager Login</h2>
          <p className="sb-auth-subtitle">Sign in to manage your cinema, menus, screens and team.</p>
          {error && <div className="sb-auth-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <label className="sb-auth-field" htmlFor="manager-email">
              <span>Email address</span>
              <input className="sb-auth-input" id="manager-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" autoComplete="username" required />
            </label>
            <label className="sb-auth-field" htmlFor="manager-password">
              <span>Password</span>
              <div className="sb-auth-input-wrap">
                <input className="sb-auth-input sb-auth-password" id="manager-password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
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
