"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ShowSchedule = { id: string; screen: string; show_start_at: string; show_end_at: string };

export default function ShowSchedulePage() {
  const supabase = createClient();
  const [cinemaId, setCinemaId] = useState("");
  const [screen, setScreen] = useState("");
  const [showStartAt, setShowStartAt] = useState("");
  const [showEndAt, setShowEndAt] = useState("");
  const [schedules, setSchedules] = useState<ShowSchedule[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role ?? user?.user_metadata?.role;
    const assignedCinema = user?.app_metadata?.cinema_id ?? user?.user_metadata?.cinema_id;
    if (authError || !user || role !== "manager" || !assignedCinema) {
      setMessage("Please sign in with the manager account assigned to this cinema.");
      setLoading(false);
      return;
    }
    setCinemaId(assignedCinema);
    const { data, error } = await supabase.from("show_schedules")
      .select("id,screen,show_start_at,show_end_at")
      .eq("cinema_id", assignedCinema).order("show_start_at", { ascending: true });
    if (error) setMessage("Could not load show schedules: " + error.message);
    else setSchedules((data || []) as ShowSchedule[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep expired shows in the database for records, but hide them from the active schedule list.
  const activeSchedules = schedules.filter(item => new Date(item.show_end_at).getTime() > now);

  async function addSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!screen.trim() || !showStartAt || !showEndAt) {
      setMessage("Enter the screen name, show start time, and show end time.");
      return;
    }
    const startDate = new Date(showStartAt);
    const endDate = new Date(showEndAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setMessage("The show end time must be later than the show start time.");
      return;
    }
    if (endDate.getTime() <= Date.now()) {
      setMessage("The show end time must be in the future.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("show_schedules").insert({
      cinema_id: cinemaId, screen: screen.trim(),
      show_start_at: startDate.toISOString(), show_end_at: endDate.toISOString(),
    });
    if (error) setMessage("Could not save show: " + error.message);
    else {
      setMessage("Show saved. Online ordering closes 30 minutes before its end time.");
      setScreen(""); setShowStartAt(""); setShowEndAt("");
      await load();
    }
    setSaving(false);
  }

  async function removeSchedule(id: string) {
    if (!window.confirm("Remove this show schedule?")) return;
    const { error } = await supabase.from("show_schedules").delete().eq("id", id).eq("cinema_id", cinemaId);
    if (error) setMessage("Could not remove show: " + error.message);
    else {
      setSchedules(current => current.filter(item => item.id !== id));
      setMessage("Show schedule removed.");
    }
  }

  return <main className="seatbite-show-schedule-page seatbite-dashboard-page" style={{minHeight:"100vh",padding:"28px 20px",background:"#f2f1ee",color:"#111"}}>
    <div style={{maxWidth:980,margin:"0 auto"}}>
      <Link href="/admin" className="seatbite-show-schedule-back-button">← Back to Manager Dashboard</Link>
      <div style={{marginTop:22,borderRadius:12,background:"#050505",color:"#fff",padding:"24px",borderBottom:"4px solid #ff0038"}}>
        <p style={{margin:0,color:"#ffffff",fontSize:12,fontWeight:900,letterSpacing:3}}>SEAT BITE · CINEMA SETTINGS</p>
        <h1 style={{margin:"10px 0",color:"#fff"}}>🎬 Show Schedule</h1>
        <p style={{margin:0,color:"#ffffff",lineHeight:1.6}}>Add each show separately for each screen. Online food ordering closes 30 minutes before that show ends. Existing orders remain visible to Food Court staff.</p>
      </div>
      <form onSubmit={addSchedule} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,background:"#fff",padding:20,border:"1px solid #deddd9",borderRadius:12,marginTop:20}}>
        <label style={{display:"grid",gap:7,fontWeight:800}}>Screen name<input value={screen} onChange={e=>setScreen(e.target.value)} placeholder="e.g. 3" required /></label>
        <label style={{display:"grid",gap:7,fontWeight:800}}>Show start date & time<input type="datetime-local" value={showStartAt} onChange={e=>setShowStartAt(e.target.value)} required /></label>
        <label style={{display:"grid",gap:7,fontWeight:800}}>Show end date & time<input type="datetime-local" value={showEndAt} onChange={e=>setShowEndAt(e.target.value)} required /></label>
        <button type="submit" disabled={saving || !cinemaId} style={{alignSelf:"end",minHeight:44,padding:"12px 18px",background:"#ff0038",color:"#fff",border:0,borderRadius:8,fontWeight:900}}>{saving?"Saving…":"＋ Add show"}</button>
      </form>
      {message && <p role="status" style={{padding:12,background:"#fff",border:"1px solid #deddd9",borderRadius:9,color:"#8a102b",fontWeight:750}}>{message}</p>}
      <h2 style={{marginTop:28}}>Saved shows</h2>
      {loading ? <p>Loading shows…</p> : activeSchedules.length===0 ? <p>No active shows. Add a new show and its start/end time above.</p> :
        <div style={{display:"grid",gap:10}}>{activeSchedules.map(item=><article key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:16,background:"#fff",border:"1px solid #deddd9",borderLeft:"4px solid #ff0038",borderRadius:10}}>
          <div>
            <strong style={{fontSize:17}}>Screen {item.screen}</strong>
            <p style={{margin:"7px 0",color:"#242424"}}><strong>Starts:</strong> {new Date(item.show_start_at).toLocaleString()}</p>
            <p style={{margin:"5px 0",color:"#242424"}}><strong>Ends:</strong> {new Date(item.show_end_at).toLocaleString()}</p>
            <small style={{color:"#8a102b",fontWeight:750}}>Ordering cutoff: {new Date(new Date(item.show_end_at).getTime()-30*60*1000).toLocaleString()}</small>
          </div>
          <button type="button" onClick={()=>removeSchedule(item.id)} style={{padding:"9px 12px",border:"1px solid #ff0038",borderRadius:8,background:"#fff",color:"#b0002b",fontWeight:850}}>Remove show</button>
        </article>)}</div>}
      <p style={{marginTop:24,fontSize:13,color:"#595959"}}>Use the exact screen name printed in the seat QR code. Each cinema manages only its own schedule.</p>
    </div>
  </main>;
}
