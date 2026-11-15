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
        <a className="sb-auth-home-link" href="/">← Back to home</a>
        <div className="sb-auth-copy">
          <p className="sb-auth-eyebrow">SEATBITE OPERATIONS</p>
          <h1>Run venue<br />service<br />with clear<br />control.</h1>
          <p>Manage cinema menus, screens and staff while keeping every order on track.</p>
          <div className="sb-auth-role-note"><strong>Manager</strong><span>Sign in with your manager account.</span></div>
        </div>
      </section>
      <section className="sb-auth-form-side">
        <img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="sb-auth-logo" />
        <div className="sb-auth-card">
          <p className="sb-auth-kicker">MANAGER ACCESS</p>
          <h2>Manager Login</h2>
          <p className="sb-auth-subtitle">Sign in with your manager account.</p>
          {error && <div className="sb-auth-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <label className="sb-auth-field" htmlFor="manager-email">
              <span>Username</span>
              <input className="sb-auth-input" id="manager-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="sb-auth-field" htmlFor="manager-password">
              <span>Password</span>
              <div className="sb-auth-input-wrap">
                <input className="sb-auth-input sb-auth-password" id="manager-password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="sb-auth-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"}>{<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.4-6.5 9.8-6.5 9.8 6.5 9.8 6.5-3.4 6.5-9.8 6.5S2.2 12 2.2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/>{showPassword && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" />}</svg>}</button>
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
