import type { Metadata } from "next";
import { Geist, Geist_Mono, Bangers, Permanent_Marker, Oswald, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bangers = Bangers({ weight: "400", variable: "--font-bangers", subsets: ["latin"], display: "swap" });
const marker = Permanent_Marker({ weight: "400", variable: "--font-marker", subsets: ["latin"], display: "swap" });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "SeatBite | Venue Ordering Platform",
  description: "A venue ordering platform for seat-based food ordering, staff operations, and cinema management.",
  applicationName: "Seat Bite",
  icons: { icon: "/seatbite-logo.webp.jpg", shortcut: "/seatbite-logo.webp.jpg", apple: "/seatbite-logo.webp.jpg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${inter.variable} ${geistMono.variable} ${bangers.variable} ${marker.variable} ${oswald.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
