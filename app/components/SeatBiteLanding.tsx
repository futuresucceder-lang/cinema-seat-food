"use client";

import Link from "next/link";

export default function SeatBiteLanding() {
  return (
    <main className="sbl-landing">
      <div className="sbl-wrap">
        <header className="sbl-nav">
          <Link href="/" className="sbl-brand" aria-label="SeatBite home"><img src="/seatbite-logo.webp.jpg" alt="SeatBite" className="seatbite-official-logo" /></Link>
          <span className="sbl-platform-pill">VENUE ORDERING PLATFORM</span>
        </header>

        <section className="sbl-hero">
          <div className="sbl-hero-copy">
            <p className="sbl-eyebrow">ORDER. WATCH. ENJOY.</p>
            <h1>Great food.<br /><em>Zero<br />intermission.</em></h1>
            <p className="sbl-hero-description">Scan the QR code on your seat, order your favourites, and enjoy your snacks without missing the show.</p>
            <div className="sbl-hero-actions">
              <Link href="/manager-login" className="sbl-primary-link">Manager<br />Login <span>→</span></Link>
              <a href="#customer-flow" className="sbl-text-link">Scan the QR on your seat</a>
            </div>
            <div className="sbl-trust-row"><span>♧ Scan. Order. Enjoy.</span></div>
          </div>
          <div className="sbl-hero-art" aria-label="Enjoy your snacks">
            <div className="sbl-popcorn-photo"><div className="sbl-popcorn-overlay"><strong>Enjoy your snacks</strong><span>delivered to your seat</span></div></div>
            <div className="sbl-qr-float"><small>SCAN QR</small><strong>ORDER YOUR SNACKS</strong></div>
          </div>
        </section>

        <nav className="sbl-shortcuts" aria-label="Platform shortcuts">
          <a id="customer-flow" href="#customer-flow"><span className="sbl-shortcut-icon">▯</span><span><small>CUSTOMER</small><strong>Scan the QR on your seat</strong></span></a>
          <Link href="/manager-login"><span className="sbl-shortcut-icon">◉</span><span><small>STAFF ACCESS</small><strong>Manager Login</strong></span><b>→</b></Link>
          <Link href="/food-court-login"><span className="sbl-shortcut-icon">◉</span><span><small>FOOD COURT</small><strong>Food Court Login</strong></span><b>→</b></Link>
          <Link href="/master-login"><span className="sbl-shortcut-icon">◉</span><span><small>MASTER ADMIN</small><strong>Master Admin Login</strong></span><b>→</b></Link>
        </nav>
        <footer className="sbl-footer">SeatBite <span>Good food. Great movies.</span></footer>
      </div>
    </main>
  );
}
