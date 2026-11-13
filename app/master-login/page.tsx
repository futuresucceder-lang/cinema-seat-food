"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MasterLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("admin@cinema.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError("");
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError || !data.user) {
      setError(loginError?.message || "Login failed. User not found.");
      setLoading(false); return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (profileError || profile?.role !== "master_admin") {
      await supabase.auth.signOut();
      setError(profileError ? "Could not verify your account role." : "This account does not have Master Admin access.");
      setLoading(false); return;
    }
    router.push("/master-admin");
    router.refresh();
  }

  return (
    <main className="sbl-login-page">
      <div className="sbl-login-shell">
        <div className="sbl-login-top"><img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="sbl-login-logo" /></div>
        <section className="sbl-login-card">
          <p className="sbl-login-kicker">PLATFORM ADMINISTRATION</p>
          <h1>Master Admin Login</h1>
          <p className="sbl-login-subtitle">Sign in with your authorized Master Admin account.</p>
          {error && <p className="sbl-login-error" role="alert">{error}</p>}
          <form onSubmit={handleLogin}>
            <label htmlFor="master-email">Email address</label>
            <input id="master-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
            <label htmlFor="master-password">Password</label>
            <div style={{position:"relative"}}>
              <input id="master-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required style={{paddingRight:76}} />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} style={{position:"absolute",right:10,top:12,border:0,background:"transparent",color:"#f04432",fontSize:12,fontWeight:800}}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <button className="sbl-login-submit" type="submit" disabled={loading}>{loading ? "SIGNING IN…" : "SIGN IN  →"}</button>
          </form>
          <a className="sbl-login-back" href="/">← Back to SeatBite Home</a>
        </section>
      </div>
    </main>
  );
}
