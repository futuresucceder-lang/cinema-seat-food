"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const inr = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
type FoodItem = {id:string|number;name:string;price:number;quantity:number;emoji?:string};
type Order = {order_code:string;tracking_token:string;cinema_id:string;screen:string|null;seat:string|null;food_items:FoodItem[];total:number|null;status:string|null;created_at:string};

function MyOrdersContent(){
  const router=useRouter(), params=useSearchParams();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState<string|null>(null);
  const cinema=params.get("cinema")||"",screen=params.get("screen")||"",seat=params.get("seat")||"";
  const menuUrl=cinema?"/?cinema="+encodeURIComponent(cinema)+"&screen="+encodeURIComponent(screen)+"&seat="+encodeURIComponent(seat):"/";
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const stored=JSON.parse(localStorage.getItem("cinema_order_tracking_tokens")||"[]");
        const tokens=Array.isArray(stored)?[...new Set(stored.filter((token):token is string=>typeof token==="string"&&/^[0-9a-f-]{36}$/i.test(token)))].slice(-100):[];
        if(!tokens.length){if(active){setOrders([]);setLoading(false);}return;}
        const result=await supabase.rpc("get_customer_orders",{p_tracking_tokens:tokens});
        if(!active)return;
        if(result.error)console.error("Could not load customer orders",result.error);
        setOrders(((result.data||[]) as Order[]).filter((order)=>!cinema || order.cinema_id===cinema));
      }catch(e){console.error(e);}
      if(active)setLoading(false);
    }
    load();
    const timer=window.setInterval(()=>{
      const stored=JSON.parse(localStorage.getItem("cinema_order_tracking_tokens")||"[]");
      const tokens=Array.isArray(stored)?stored.filter((token):token is string=>typeof token==="string"&&/^[0-9a-f-]{36}$/i.test(token)).slice(-100):[];
      if(tokens.length)supabase.rpc("get_customer_orders",{p_tracking_tokens:tokens}).then(({data,error})=>{if(!error&&data)setOrders(data as Order[]);});
    },5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[cinema]);
  const status=(s:string|null)=>(s||"NEW").toUpperCase();
  const active=(s:string|null)=>["NEW","PREPARING","READY"].includes(status(s));
  const label=(s:string|null)=>({NEW:"● Received",PREPARING:"● Preparing",READY:"● Ready",COMPLETED:"✓ Delivered",CANCELLED:"× Cancelled"} as Record<string,string>)[status(s)]||"Received";
  function track(token:string){router.push("/order-status?token="+encodeURIComponent(token));}
  return <main className="sb-customer-page"><div className="sb-page-shell">
    <header className="sb-header"><a href={menuUrl} className="sb-logo-link"><img src="/seatbite-logo.webp.jpg" alt="SeatBite"/></a><button className="sb-header-order" onClick={()=>router.push(menuUrl)}><span>🛒</span> My Order <b>0</b></button></header>
    <section className="sb-hero sb-hero-orders"><div className="sb-hero-copy"><p className="sb-kicker">YOUR MOVIE NIGHT, ALL IN ONE PLACE</p><h1>My Orders</h1><p>Your past orders &amp; latest status</p></div><div className="sb-hero-art" aria-hidden="true"><img src="/seatbite-cinema-hero.svg" alt=""/></div></section>
    <section className="sb-orders-heading"><div><p className="sb-kicker">ORDER HISTORY</p><h2>Your snack moments</h2><p>Keep track of everything you’ve ordered at your seat.</p></div><span>{orders.length} {orders.length===1?"ORDER":"ORDERS"}</span></section>
    {loading?<div className="sb-loading">Loading your orders…</div>:orders.length===0?<section className="sb-empty-state"><span>🍿</span><h2>No orders yet!</h2><p>Your movie snack journey starts here.</p><button onClick={()=>router.push(menuUrl)}>Explore Menu</button></section>:
    <section className="sb-order-history-list">{orders.map(order=>{
      const items=order.food_items||[],statusValue=status(order.status),open=expanded===order.order_code;
      return <article className="sb-history-card" key={order.order_code}>
        <div className="sb-history-main-image">{items[0]?.emoji||"🍿"}</div>
        <div className="sb-history-content">
          <div className="sb-history-top"><div><h3>Order #{order.order_code}</h3><p>▦ {new Date(order.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</p></div><span className={"sb-status-pill "+statusValue.toLowerCase()}>{label(order.status)}</span></div>
          <div className="sb-history-thumbs">{items.slice(0,3).map((item,i)=><span key={String(item.id)+i}>{item.emoji||"🍿"}</span>)}{items.length>3&&<small>+{items.length-3} more</small>}</div>
          <div className="sb-history-bottom"><strong>Total: <b>{inr(Number(order.total)||0)}</b></strong>{active(order.status)?<button onClick={()=>track(order.tracking_token)}>Track Order ›</button>:<button onClick={()=>setExpanded(open?null:order.order_code)}>{open?"Hide Details":"View Details ›"}</button>}</div>
          {open&&<div className="sb-expanded-details"><p>Screen <b>{order.screen||"—"}</b> · Seat <b>{order.seat||"—"}</b></p>{items.map((item,i)=><div key={String(item.id)+i}><span>{item.emoji||"🍽️"} {item.name} × {item.quantity||1}</span><b>{inr((Number(item.price)||0)*(item.quantity||1))}</b></div>)}</div>}
        </div>
      </article>;
    })}</section>}
    <div className="sb-page-actions"><button className="sb-outline-button" onClick={()=>router.push(menuUrl)}>← Back to Menu</button><button className="sb-primary-button" onClick={()=>router.push(menuUrl)}>Order More Food →</button></div>
    <footer className="sb-footer"><span>🎞</span> Enjoy the Movie with <b>SEAT BITE</b> ♥</footer>
  </div></main>;
}
export default function MyOrdersPage(){return <Suspense fallback={<main className="sb-customer-page"><div className="sb-loading">🍿 Loading your orders…</div></main>}><MyOrdersContent/></Suspense>;}
