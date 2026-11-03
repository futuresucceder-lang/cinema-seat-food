"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  return (
    <main className="sb-staff-login">
      <section className="sb-login-story">
        <Link href="/" className="sb-back-link">← &nbsp;Back to home</Link>
        <div>
          <p className="sb-eyebrow">SEATBITE OPERATIONS</p>
          <h1>Run venue service<br />with clear control.</h1>
          <p>Manage venues, screens, seats, catalog, orders, and delivery from one place.</p>
        </div>
        <div className="sb-login-story-bottom"><strong>Admin</strong><span>sign in with your real staff account</span></div>
      </section>
      <section className="sb-login-form-side">
        <div className="sb-login-form-wrap">
          <div className="sb-login-brand"><span>▥</span> SeatBite</div>
          <p className="sb-eyebrow">STAFF ACCESS</p>
          <h2>Welcome back</h2>
          <p className="sb-login-subtitle">Enter your credentials to continue.</p>
          {error && <div className="sb-login-error" role="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <label htmlFor="email"> <span style={{color:"#fa4029"}}>*</span> Username
              <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder=" " required autoComplete="username" />
            </label>
            <label htmlFor="password"><span style={{color:"#fa4029"}}>*</span> Password
              <div style={{position:"relative"}}>
                <input id="password" type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder=" " required autoComplete="current-password" style={{paddingRight:65}} />
                <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} style={{position:"absolute",right:12,top:18,border:0,background:"transparent",color:"#788080",fontSize:12}}>{showPassword?"Hide":"◉"}</button>
              </div>
            </label>
            <button className="sb-login-submit" type="submit" disabled={loading}>{loading?"Signing in…":"Enter dashboard  →"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
