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
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const role = userData.user?.app_metadata?.role;
    if (role === "manager") {
      router.push("/admin");
      router.refresh();
      return;
    }
    await supabase.auth.signOut();
    setError("This account does not have Manager access. Please use the correct staff login.");
    setLoading(false);
  }

  return (
    <main className="sbl-login-page">
      <div className="sbl-login-shell">
        <div className="sbl-login-top"><img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="sbl-login-logo" /></div>
        <section className="sbl-login-card">
          <p className="sbl-login-kicker">STAFF ACCESS</p>
          <h1>Manager Login</h1>
          <p className="sbl-login-subtitle">Manage your cinema, menu, screens and orders.</p>
          {error && <p className="sbl-login-error" role="alert">{error}</p>}
          <form onSubmit={handleLogin}>
            <label htmlFor="manager-email">Email address</label>
            <input id="manager-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="username" required />
            <label htmlFor="manager-password">Password</label>
            <div style={{position:"relative"}}>
              <input id="manager-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required style={{paddingRight:76}} />
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
