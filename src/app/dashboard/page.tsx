"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useState, useCallback } from "react";

type VideoStatus = "idle" | "uploading" | "transcribing" | "analyzing" | "rendering" | "done" | "error";

const CAPTION_STYLES = [
  { id: "default", name: "Default", desc: "Paprastas baltas tekstas", preview: "Aa" },
  { id: "cinematic", name: "Cinematic", desc: "Kinematografinis, su šešėliu", preview: "Aa" },
  { id: "bold-center", name: "Hormozi", desc: "Bold, centras, didelis", preview: "Aa" },
  { id: "tiktok", name: "TikTok", desc: "Spalvotas word-by-word", preview: "Aa" },
  { id: "mrbeast", name: "MrBeast", desc: "Geltonas, impact, didelis", preview: "Aa" },
  { id: "minimal", name: "Minimal", desc: "Subtilus, apatiniame kampe", preview: "Aa" },
  { id: "neon", name: "Neon Glow", desc: "Šviečiantis neon efektas", preview: "Aa" },
  { id: "typewriter", name: "Typewriter", desc: "Rašomosios mašinėlės efektas", preview: "Aa" },
  { id: "karaoke", name: "Karaoke", desc: "Highlight per žodį", preview: "Aa" },
  { id: "outline", name: "Viral Outline", desc: "Storais kontūrais", preview: "Aa" },
];

const FEATURES = [
  { id: "captions", name: "📝 Subtitrai", desc: "Auto subtitrai su stilių pasirinkimu" },
  { id: "silence", name: "✂️ Remove Silences", desc: "Pašalinti tylias vietas" },
  { id: "broll", name: "🎬 Auto B-Roll", desc: "AI sugeneruotas b-roll" },
  { id: "titles", name: "🎨 Title Cards", desc: "Animuoti titulai" },
  { id: "music", name: "🎵 Background Music", desc: "Fono muzika pagal nuotaiką" },
  { id: "splitscreen", name: "📺 Split Screen", desc: "Kalbėtojas + vizualai" },
];

export default function Dashboard() {
  const { user } = useUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["captions", "silence"]);
  const [captionStyle, setCaptionStyle] = useState("default");
  const [status, setStatus] = useState<VideoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "both">("9:16");
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setProgress(10);

    // TODO: Implement actual upload & processing pipeline
    // For now, simulating the flow
    const steps: { status: VideoStatus; progress: number; delay: number }[] = [
      { status: "uploading", progress: 25, delay: 1500 },
      { status: "transcribing", progress: 40, delay: 2000 },
      { status: "analyzing", progress: 60, delay: 1500 },
      { status: "rendering", progress: 80, delay: 2000 },
      { status: "done", progress: 100, delay: 1000 },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, step.delay));
      setStatus(step.status);
      setProgress(step.progress);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            <span className="text-[var(--accent)]">AI</span> Tendencijos
          </h1>
          <span className="text-xs bg-[var(--accent)] px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Sveiki, {user?.firstName || "User"}
          </span>
          <UserButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Upload Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4">🎬 Naujas video</h2>

          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : selectedFile
                ? "border-[var(--success)] bg-[var(--success)]/5"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div>
                <p className="text-[var(--success)] text-lg font-semibold">
                  ✅ {selectedFile.name}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="mt-3 text-sm text-gray-500 hover:text-[var(--danger)]"
                >
                  Pašalinti
                </button>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-3">📁</p>
                <p className="text-lg font-semibold mb-1">
                  Nutempk video čia
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  arba paspausk pasirinkti
                </p>
                <label className="cursor-pointer px-6 py-2 bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] rounded-lg transition-colors">
                  Pasirinkti failą
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Features Selection */}
        {selectedFile && (
          <>
            <section>
              <h2 className="text-xl font-bold mb-4">⚡ Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FEATURES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedFeatures.includes(f.id)
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    <p className="font-semibold text-sm">{f.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{f.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Caption Styles */}
            {selectedFeatures.includes("captions") && (
              <section>
                <h2 className="text-xl font-bold mb-4">🎨 Subtitrų stilius</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {CAPTION_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCaptionStyle(s.id)}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        captionStyle === s.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <div className="text-2xl font-bold mb-2 text-white">{s.preview}</div>
                      <p className="font-semibold text-xs">{s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Aspect Ratio */}
            <section>
              <h2 className="text-xl font-bold mb-4">📐 Formatas</h2>
              <div className="flex gap-3">
                {[
                  { id: "9:16" as const, label: "9:16", desc: "Reels / TikTok" },
                  { id: "16:9" as const, label: "16:9", desc: "YouTube" },
                  { id: "both" as const, label: "Abu", desc: "9:16 + 16:9" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setAspectRatio(r.id)}
                    className={`px-6 py-3 rounded-xl border transition-all ${
                      aspectRatio === r.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    <p className="font-bold">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Process Button */}
            <section>
              {status === "idle" ? (
                <button
                  onClick={handleProcess}
                  className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-bold text-lg transition-colors"
                >
                  🚀 Pradėti apdorojimą
                </button>
              ) : status === "done" ? (
                <div className="text-center p-8 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-[var(--success)] font-bold text-lg">Video paruoštas!</p>
                  <button className="mt-4 px-8 py-3 bg-[var(--success)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
                    📥 Atsisiųsti
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold">
                      {status === "uploading" && "📤 Įkeliama..."}
                      {status === "transcribing" && "📝 Transkribuojama..."}
                      {status === "analyzing" && "🧠 AI analizuoja..."}
                      {status === "rendering" && "🎬 Renderinama..."}
                      {status === "error" && "❌ Klaida"}
                    </span>
                    <span className="text-sm text-gray-400">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
