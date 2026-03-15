import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Tendencijos - Video Editor",
  description: "AI-powered video editing platform. Subtitrai, b-roll, motion graphics automatiškai.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
