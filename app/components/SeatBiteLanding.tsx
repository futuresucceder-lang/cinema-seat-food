"use client";

import Link from "next/link";

export default function SeatBiteLanding() {
  return (
    <main className="sb-landing">
      <div className="sb-landing-wrap">
        <header className="sb-nav">
          <Link href="/" className="sb-brand"><span className="sb-brand-mark">▥</span><span>SeatBite</span></Link>
          <span className="sb-platform-pill">VENUE ORDERING PLATFORM</span>
        </header>

        <section className="sb-hero">
          <div className="sb-hero-copy">
            <p className="sb-eyebrow">ORDER. WATCH. ENJOY.</p>
            <h1>Great food.<br /><em>Zero<br />intermission.</em></h1>
            <p className="sb-hero-description">Guests scan their seat QR, place orders, and get food delivered without leaving the show. Staff manage the full workflow from one operations console.</p>
            <div className="sb-hero-actions">
              <Link href="/manager-login" className="sb-primary-link">Open<br />operations <span>→</span></Link>
              <a href="#customer-flow" className="sb-text-link">Customer ordering begins from a live seat QR <span>↗</span></a>
            </div>
            <div className="sb-trust-row"><span>♧ Secure seat QR</span><span>10 min average prep</span></div>
          </div>
          <div className="sb-hero-art" aria-label="Caramel popcorn served to your seat">
            <div className="sb-popcorn-photo"><div className="sb-popcorn-overlay"><small>NOW SERVING</small><strong>Caramel<br />Popcorn</strong><span>delivered to your seat</span></div></div>
            <div className="sb-qr-float"><small>SCAN QR</small><strong>SEAT</strong><span>ORDER HERE</span></div>
          </div>
        </section>

        <nav className="sb-shortcuts" aria-label="Platform shortcuts">
          <a id="customer-flow" href="#customer-flow"><span className="sb-shortcut-icon">▯</span><span><small>CUSTOMER FLOW</small><strong>Use live seat QR codes inside the venue</strong></span><b>↗</b></a>
          <Link href="/manager-login"><span className="sb-shortcut-icon">◉</span><span><small>LIVE ORDER BOARD</small><strong>Staff dashboard</strong></span><b>→</b></Link>
          <Link href="/master-admin"><span className="sb-shortcut-icon">◉</span><span><small>VENUE CONTROL</small><strong>Admin dashboard</strong></span><b>→</b></Link>
        </nav>
        <footer className="sb-landing-footer">SeatBite <span>Good food. Great movies.</span></footer>
      </div>
    </main>
  );
}
