import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cineflow — Dashboard",
  description: "AI-powered video editing dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#09090b",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
