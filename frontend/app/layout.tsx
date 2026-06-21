import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShunyaScape 3D - Interactive City Builder & Agent Simulator",
  description: "An interactive, real-time 3D city builder and agent simulation. Build roads, trees, houses, and skyscrapers, watch human agents commute, and control the day-night cycle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full antialiased overflow-hidden" suppressHydrationWarning>
      <body className="h-full w-full overflow-hidden bg-slate-950">{children}</body>
    </html>
  );
}

