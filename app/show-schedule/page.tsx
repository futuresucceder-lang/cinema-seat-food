"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ShowSchedule = { id: string; screen: string; show_end_at: string };

export default function ShowSchedulePage() {
  const supabase = createClient();
  const [cinemaId, setCinemaId] = useState("");
  const [screen, setScreen] = useState("");
  const [showEndAt, setShowEndAt] = useState("");
  const [schedules, setSchedules] = useState<ShowSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role ?? user?.user_metadata?.role;
    const assignedCinema = user?.app_metadata?.cinema_id ?? user?.user_metadata?.cinema_id;
    if (authError || !user || role !== "manager" || !assignedCinema) {
      setMessage("Please sign in with the manager account assigned to this cinema.");
      setLoading(false); return;
    }
    setCinemaId(assignedCinema);
    const { data, error } = await supabase.from("show_schedules").select("id,screen,show_end_at")
      .eq("cinema_id", assignedCinema).order("show_end_at", { ascending: true });
    if (error) setMessage("Could not load show schedules: " + error.message);
    else setSchedules((data || []) as ShowSchedule[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addSchedule(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (!screen.trim() || !showEndAt) { setMessage("Enter the exact screen name from the seat QR code and show end date/time."); return; }
    const endDate = new Date(showEndAt);
    if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= Date.now()) { setMessage("The show end time must be in the future."); return; }
    setSaving(true);
    const { error } = await supabase.from("show_schedules").insert({ cinema_id: cinemaId, screen: screen.trim(), show_end_at: endDate.toISOString() });
    if (error) setMessage("Could not save show time: " + error.message);
    else { setMessage("Show time saved. Ordering closes 30 minutes before the show ends."); setScreen(""); setShowEndAt(""); await load(); }
    setSaving(false);
  }
  async function removeSchedule(id: string) {
    if (!window.confirm("Remove this show schedule?")) return;
    const { error } = await supabase.from("show_schedules").delete().eq("id", id).eq("cinema_id", cinemaId);
    if (error) setMessage("Could not remove show time: " + error.message);
    else { setSchedules(current => current.filter(item => item.id !== id)); setMessage("Show schedule removed."); }
  }
  return <main className="seatbite-dashboard-page" style={{minHeight:"100vh",padding:"28px 20px",background:"#fff8f4",color:"#202124"}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <Link href="/admin" style={{color:"#b93824",fontWeight:800}}>← Back to Manager Dashboard</Link>
      <h1 style={{marginTop:20}}>🎬 Show Schedule & Ordering Cutoff</h1>
      <p style={{color:"#59473f",lineHeight:1.6}}>Add each show separately. Seat Bite closes ordering 30 minutes before its end time. Use the same screen name that appears in the seat QR code. Existing orders remain in the Food Court.</p>
      <form onSubmit={addSchedule} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,background:"#fff",padding:20,border:"1px solid #f0e5df",borderRadius:16,marginTop:20}}>
        <label style={{display:"grid",gap:7,fontWeight:700}}>Screen name<input value={screen} onChange={e=>setScreen(e.target.value)} placeholder="e.g. 3" required /></label>
        <label style={{display:"grid",gap:7,fontWeight:700}}>Show end date & time<input type="datetime-local" value={showEndAt} onChange={e=>setShowEndAt(e.target.value)} required /></label>
        <button type="submit" disabled={saving || !cinemaId} style={{alignSelf:"end",padding:"12px 18px",background:"#f45135",color:"#fff",border:0,borderRadius:10,fontWeight:800}}>{saving?"Saving…":"Add show schedule"}</button>
      </form>
      {message && <p role="status" style={{padding:12,background:"#fff0e9",borderRadius:10,color:"#7f2417",fontWeight:700}}>{message}</p>}
      <h2 style={{marginTop:28}}>Saved show times</h2>
      {loading ? <p>Loading schedules…</p> : schedules.length===0 ? <p>No show times have been added yet. Cutoff enforcement activates for a screen after its first schedule is added.</p> :
        <div style={{display:"grid",gap:10}}>{schedules.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:16,background:"#fff",border:"1px solid #f0e5df",borderRadius:12}}>
          <div><strong>Screen {item.screen}</strong><p style={{margin:"5px 0",color:"#59473f"}}>Show ends: {new Date(item.show_end_at).toLocaleString()}</p><small style={{color:"#9a3412"}}>Ordering cutoff: {new Date(new Date(item.show_end_at).getTime()-30*60*1000).toLocaleString()}</small></div>
          <button type="button" onClick={()=>removeSchedule(item.id)} style={{padding:"9px 12px",border:"1px solid #f45135",borderRadius:9,background:"#fff",color:"#b93824",fontWeight:800}}>Remove</button>
        </div>)}</div>}
      <p style={{marginTop:24,fontSize:13,color:"#756b66"}}>Keep the next show end time updated for every screen.</p>
    </div>
  </main>;
}
