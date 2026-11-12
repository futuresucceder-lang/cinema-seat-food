"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase=createClient();
const inr=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
type FoodItem={id?:string;name:string;price?:number;emoji?:string;quantity?:number};
type Order={order_code:string;cinema_id?:string|null;screen:string;seat:string;food_items:FoodItem[];total:number;status:string;created_at:string;delivery_option?:string|null};

function TrackingContent(){
  const params=useSearchParams(),router=useRouter(),code=params.get("order");
  const [order,setOrder]=useState<Order|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{
    if(!code){setError("Order information is missing.");setLoading(false);return;}
    let active=true;
    async function load(){const r=await supabase.from("orders").select("*").eq("order_code",code).single();if(!active)return;if(r.error){console.error(r.error);setError("We couldn’t find this order.");}else setOrder(r.data as Order);setLoading(false);}
    load();
    const channel=supabase.channel("track-"+code).on("postgres_changes",{event:"UPDATE",schema:"public",table:"orders",filter:"order_code=eq."+code},payload=>setOrder(payload.new as Order)).subscribe();
    return()=>{active=false;supabase.removeChannel(channel);};
  },[code]);
  if(loading)return <main className="sb-customer-page"><div className="sb-loading">🍿 Loading your order…</div></main>;
  if(error||!order)return <main className="sb-customer-page"><div className="sb-page-shell"><section className="sb-empty-state"><span>🍿</span><h2>Order not found</h2><p>{error}</p><button onClick={()=>router.push("/my-orders")}>Back to My Orders</button></section></div></main>;
  const status=(order.status||"NEW").toUpperCase();
  const menuUrl=order.cinema_id?"/?cinema="+encodeURIComponent(order.cinema_id)+"&screen="+encodeURIComponent(order.screen)+"&seat="+encodeURIComponent(order.seat):"/";
  const steps=[{label:"Order Placed",done:["NEW","PREPARING","READY","COMPLETED"].includes(status),icon:"✓"},{label:"Preparing",done:["PREPARING","READY","COMPLETED"].includes(status),icon:"♨"},{label:"Out for Delivery",done:["READY","COMPLETED"].includes(status),icon:"♧"},{label:"Delivered",done:status==="COMPLETED",icon:"✓"}];
  const copy:Record<string,[string,string,string]>={NEW:["Your order has been received!","Our cinema team has received your snack order.","✓"],PREPARING:["Preparing Your Order…","Our team is getting your food ready!","◷"],READY:["Your food is ready!","Your snacks are ready to be delivered to your seat.","♧"],COMPLETED:["Enjoy your food!","Your order has been delivered. Enjoy the movie!","♥"],CANCELLED:["This order has been cancelled.","Please contact cinema staff if you need assistance.","×"]};
  const message=copy[status]||["Your order is being updated","This page updates automatically when the team changes your order status.","•"];
  return <main className="sb-customer-page"><div className="sb-page-shell">
    <header className="sb-header"><a href={menuUrl} className="sb-logo-link"><img src="/seatbite-logo.webp.jpg" alt="SeatBite"/></a><button className="sb-header-order" onClick={()=>router.push("/my-orders")}><span>🛒</span> My Order <b>0</b></button></header>
    <section className="sb-hero sb-hero-track"><div className="sb-hero-copy"><p className="sb-kicker">YOUR MOVIE NIGHT, IN MOTION</p><h1>Track Your<br/><em>Order</em></h1><p>Sit Back • Relax • We’ll Take Care</p></div><div className="sb-hero-art" aria-hidden="true">🍿</div></section>
    <section className={"sb-progress-card "+(status==="COMPLETED"?"is-complete":"")}>
      <div className="sb-progress-line"><span style={{width:status==="NEW"?"0%":status==="PREPARING"?"33%":status==="READY"?"66%":status==="COMPLETED"?"100%":"0%"}}/></div>
      {steps.map((step,i)=><div className={"sb-progress-step "+(step.done?"active":"")} key={step.label}><div className="sb-progress-icon">{step.done?"✓":step.icon}</div><strong>{step.label}</strong></div>)}
    </section>
    <section className={"sb-status-banner "+(status==="COMPLETED"?"success":status==="CANCELLED"?"cancelled":"")}><span className="sb-status-symbol">{message[2]}</span><div><h2>{message[0]}</h2><p>{message[1]}</p></div></section>
    <section className="sb-order-detail-card">
      <div className="sb-order-card-top"><div><p className="sb-label">ORDER NUMBER</p><h2>Order #{order.order_code}</h2><p className="sb-date">▦ {new Date(order.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</p></div><span className={"sb-status-pill "+status.toLowerCase()}>{status==="COMPLETED"?"✓ Delivered":status==="CANCELLED"?"× Cancelled":status.replace("_"," ")}</span></div>
      <div className="sb-screen-seat"><span>Screen <b>{order.screen}</b></span><i/><span>Seat <b>{order.seat}</b></span></div>
      <h3>Your Items</h3><div className="sb-items-list">{(order.food_items||[]).map((item,i)=><div className="sb-order-item" key={item.id||i}><span className="sb-food-emoji">{item.emoji||"🍿"}</span><div><strong>{item.name}</strong><b>{inr((item.price||0)*(item.quantity||1))}</b></div><span>×{item.quantity||1}</span></div>)}</div>
      <div className="sb-order-total"><span>Total Amount</span><strong>{inr(Number(order.total)||0)}</strong></div>
      <div className="sb-delivery-tag">{order.delivery_option==="INTERVAL"?"◷ Deliver During Interval":"⚡ Deliver Now"}</div>
    </section>
    <div className="sb-page-actions"><button className="sb-outline-button" onClick={()=>router.push("/my-orders")}>← Back to My Orders</button><button className="sb-primary-button" onClick={()=>router.push(menuUrl)}>Order More Food →</button></div>
    <footer className="sb-footer"><span>🎞</span> Enjoy the Movie with <b>SEAT BITE</b> ♥</footer>
  </div></main>;
}
export default function OrderStatusPage(){return <Suspense fallback={<main className="sb-customer-page"><div className="sb-loading">🍿 Loading your order…</div></main>}><TrackingContent/></Suspense>;}
