"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LegacyOrderRedirect() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const cinema = params.get("cinema");
    const screen = params.get("screen");
    const seat = params.get("seat");

    if (!cinema || !screen || !seat) return;

    const query = new URLSearchParams({ cinema, screen, seat });
    router.replace("/?" + query.toString());
  }, [params, router]);

  const validQr = Boolean(params.get("cinema") && params.get("screen") && params.get("seat"));

  return (
    <main className="seatbite-page seatbite-loading">
      <div className="seatbite-loader">🍿</div>
      <p>{validQr ? "Opening the latest Seat Bite menu…" : "This QR code is missing cinema, screen, or seat information. Please ask cinema staff for a new seat QR code."}</p>
    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<main className="seatbite-page seatbite-loading"><p>Opening Seat Bite…</p></main>}>
      <LegacyOrderRedirect />
    </Suspense>
  );
}
