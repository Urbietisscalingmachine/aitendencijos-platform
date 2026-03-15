"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero */}
      <div className="text-center max-w-3xl">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-[var(--accent)]">AI</span> Video Editor
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          Įkelk video. Pasirink stilių. Gauk rezultatą.
        </p>
        <p className="text-gray-500 mb-8">
          Automatiniai subtitrai • B-roll • Motion graphics • Silence removal
        </p>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center">
          <SignUpButton mode="modal">
            <button className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold transition-colors text-lg">
              Pradėti nemokamai →
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="px-8 py-3 border border-[var(--border)] hover:border-[var(--accent)] text-white rounded-lg font-semibold transition-colors text-lg">
              Prisijungti
            </button>
          </SignInButton>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16 max-w-4xl">
        {[
          { icon: "📝", title: "Auto subtitrai", desc: "20+ stilių, word-by-word animacijos" },
          { icon: "✂️", title: "Silence removal", desc: "Automatiškai pašalina tylias vietas" },
          { icon: "🎬", title: "AI B-Roll", desc: "Generuoja b-roll iš prompto" },
          { icon: "🎨", title: "Motion graphics", desc: "Animuoti titulai ir efektai" },
        ].map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-gray-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-gray-600 text-sm mt-16">
        © 2026 AI Tendencijos. Powered by AI.
      </p>
    </div>
  );
}
