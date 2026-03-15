import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Tendencijos - Video Editor",
  description: "AI-powered video editing platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="lt">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
