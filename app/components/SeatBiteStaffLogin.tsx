"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginMode = "manager" | "master_admin";

export default function SeatBiteStaffLogin({ mode }: { mode: LoginMode }) {
  const router = useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const isAdmin=mode==="master_admin";

  async function handleLogin(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError(""); setLoading(true);
    const supabase=createClient();
    const {error:loginError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(loginError){setError("Invalid email or password.");setLoading(false);return;}
    const {data:{user}}=await supabase.auth.getUser();
    const role=user?.app_metadata?.role;
    if(isAdmin){
      const {data:profile}=user?await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():{data:null};
      if(role==="master_admin"||profile?.role==="master_admin"){router.push("/master-admin");router.refresh();return;}
    }else{
      if(role==="manager"){router.push("/admin");router.refresh();return;}
      if(role==="food_court"){router.push("/food-court");router.refresh();return;}
    }
    await supabase.auth.signOut();
    setError(isAdmin?"This account does not have Master Admin access.":"This account does not have Manager or Food Court access.");
    setLoading(false);
  }

  return <main className="sb-staff-login">
    <section className="sb-login-story">
      <Link href="/" className="sb-back-link">← &nbsp;Back to home</Link>
      <div className="sb-login-story-copy">
        <p className="sb-eyebrow">SEATBITE OPERATIONS</p>
        <h1>Run venue<br/>service<br/>with clear<br/>control.</h1>
        <p>Manage venues, screens, seats, catalog, orders, and delivery from one place.</p>
      </div>
      <div className="sb-login-story-bottom"><strong>{isAdmin?"Master Admin":"Manager"}</strong><span>{isAdmin?"sign in with your Master Admin account":"sign in with your Manager staff account"}</span></div>
    </section>
    <section className="sb-login-form-side">
      <div className="sb-login-form-wrap">
        <div className="sb-login-brand"><span>▥</span> SeatBite</div>
        <p className="sb-eyebrow">{isAdmin?"MASTER ADMIN ACCESS":"MANAGER ACCESS"}</p>
        <h2>{isAdmin?"Master Admin Login":"Manager Login"}</h2>
        <p className="sb-login-subtitle">{isAdmin?"Sign in with your Master Admin account.":"Sign in with your Manager staff account."}</p>
        {error&&<div className="sb-login-error" role="alert">{error}</div>}
        <form onSubmit={handleLogin}>
          <label htmlFor="staff-email"><span style={{color:"#fa4029"}}>*</span> Username
            <input id="staff-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/>
          </label>
          <label htmlFor="staff-password"><span style={{color:"#fa4029"}}>*</span> Password
            <div style={{position:"relative"}}>
              <input id="staff-password" type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" style={{paddingRight:65}}/>
              <button type="button" className="sb-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword}>
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 9 4.5 10 7-.4 1-1.3 2.3-2.6 3.5M6.2 6.2C3.8 7.7 2.4 10 2 12c1 2.5 4.8 7 10 7 1.2 0 2.3-.2 3.3-.7"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </label>
          <button className="sb-login-submit" type="submit" disabled={loading}>{loading?"Signing in…":isAdmin?"Enter admin dashboard  →":"Enter manager dashboard  →"}</button>
        </form>
      </div>
    </section>
  </main>;
}
