"use client";

import Link from "next/link";

export default function SeatBiteLanding() {
  return (
    <main className="sb-landing">
      <div className="sb-landing-wrap">
        <header className="sb-nav">
          <Link href="/" className="sb-brand"><span className="sb-brand-mark">▥</span><span className="sb-brand-word"><span className="sb-brand-seat">SEAT</span><span className="sb-brand-bite">BITE</span></span></Link>
          <span className="sb-platform-pill">VENUE ORDERING PLATFORM</span>
        </header>

        <section className="sb-hero">
          <div className="sb-hero-copy">
            <p className="sb-eyebrow">ORDER. WATCH. ENJOY.</p>
            <h1>Great food.<br /><em>Zero<br />intermission.</em></h1>
            <p className="sb-hero-description">Scan the QR code on your seat, order your favourites, and enjoy your snacks without missing the show.</p>
            <div className="sb-hero-actions">
              <Link href="/manager-login" className="sb-primary-link">Manager<br />Login <span>→</span></Link>
              <a href="#customer-flow" className="sb-text-link">Scan the QR on your seat</a>
            </div>
            <div className="sb-trust-row"><span>♧ Scan. Order. Enjoy.</span></div>
          </div>
          <div className="sb-hero-art" aria-label="Enjoy your snacks">
            <div className="sb-popcorn-photo"><div className="sb-popcorn-overlay"><strong>Enjoy your snacks</strong><span>delivered to your seat</span></div></div>
            <div className="sb-qr-float"><small>SCAN QR</small><strong>ORDER YOUR SNACKS</strong></div>
          </div>
        </section>

        <nav className="sb-shortcuts" aria-label="Platform shortcuts">
          <a id="customer-flow" href="#customer-flow"><span className="sb-shortcut-icon">▯</span><span><small>CUSTOMER</small><strong>Scan the QR on your seat</strong></span></a>
          <Link href="/manager-login"><span className="sb-shortcut-icon">◉</span><span><small>STAFF ACCESS</small><strong>Manager Login</strong></span><b>→</b></Link>
          <Link href="/food-court-login"><span className="sb-shortcut-icon">◉</span><span><small>FOOD COURT</small><strong>Food Court Login</strong></span><b>→</b></Link>
          <Link href="/master-admin-login"><span className="sb-shortcut-icon">◉</span><span><small>MASTER ADMIN</small><strong>Master Admin Login</strong></span><b>→</b></Link>
        </nav>
        <footer className="sb-landing-footer">SeatBite <span>Good food. Great movies.</span></footer>
      </div>
    </main>
  );
}
