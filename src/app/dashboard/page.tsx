"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* ───────────────────────── types ───────────────────────── */

interface Feature {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  defaultOn: boolean;
}

interface CaptionStyle {
  id: string;
  label: string;
  className: string; // tailwind + inline‑safe classes applied to "Aa"
  style: React.CSSProperties;
}

type AspectRatio = "9:16" | "16:9" | "both";

type ProcessStage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done";

/* ───────────────────── constants ───────────────────── */

const FEATURES: Feature[] = [
  {
    id: "subtitles",
    emoji: "📝",
    label: "Subtitrai",
    desc: "Automatiniai subtitrai su AI",
    defaultOn: true,
  },
  {
    id: "silence",
    emoji: "✂️",
    label: "Remove Silences",
    desc: "Pašalinti tylias vietas",
    defaultOn: true,
  },
  {
    id: "broll",
    emoji: "🎬",
    label: "Auto B-Roll",
    desc: "AI parinktas B-Roll footage",
    defaultOn: false,
  },
  {
    id: "titles",
    emoji: "🎨",
    label: "Title Cards",
    desc: "Animuoti antraštiniai kadrai",
    defaultOn: false,
  },
  {
    id: "music",
    emoji: "🎵",
    label: "Background Music",
    desc: "Foninė muzika pagal nuotaiką",
    defaultOn: false,
  },
  {
    id: "split",
    emoji: "📺",
    label: "Split Screen",
    desc: "Dual‑view padalintas ekranas",
    defaultOn: false,
  },
];

const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: "default",
    label: "Default",
    className: "",
    style: { color: "#fff", fontFamily: "inherit", fontSize: 22, fontWeight: 600 },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    className: "",
    style: {
      color: "#e2e0d9",
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 22,
      fontWeight: 500,
      textShadow: "2px 3px 8px rgba(0,0,0,0.7)",
      letterSpacing: 1,
    },
  },
  {
    id: "hormozi",
    label: "Hormozi",
    className: "",
    style: {
      color: "#fff",
      fontFamily: "inherit",
      fontSize: 26,
      fontWeight: 900,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
  },
  {
    id: "tiktok",
    label: "TikTok",
    className: "",
    style: {
      color: "#fff",
      fontFamily: "inherit",
      fontSize: 22,
      fontWeight: 700,
      background: "linear-gradient(90deg,#ff006e,#8338ec,#3a86ff)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
  },
  {
    id: "mrbeast",
    label: "MrBeast",
    className: "",
    style: {
      color: "#facc15",
      fontFamily: "'Impact', 'Arial Black', sans-serif",
      fontSize: 26,
      fontWeight: 900,
      textShadow: "2px 2px 0 #000, -1px -1px 0 #000",
      letterSpacing: 1,
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    className: "",
    style: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: "inherit",
      fontSize: 14,
      fontWeight: 400,
      letterSpacing: 0.5,
    },
  },
  {
    id: "neon",
    label: "Neon Glow",
    className: "",
    style: {
      color: "#c084fc",
      fontFamily: "inherit",
      fontSize: 24,
      fontWeight: 700,
      textShadow:
        "0 0 7px #c084fc, 0 0 14px #c084fc, 0 0 28px #8b5cf6, 0 0 42px #8b5cf6",
    },
  },
  {
    id: "typewriter",
    label: "Typewriter",
    className: "",
    style: {
      color: "#d4d4d8",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 20,
      fontWeight: 500,
      letterSpacing: 2,
    },
  },
  {
    id: "karaoke",
    label: "Karaoke",
    className: "",
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: "#fff",
      fontFamily: "inherit",
      background: "linear-gradient(90deg, #8b5cf6 50%, rgba(255,255,255,0.35) 50%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
  },
  {
    id: "outline",
    label: "Viral Outline",
    className: "",
    style: {
      color: "#fff",
      fontFamily: "inherit",
      fontSize: 24,
      fontWeight: 900,
      WebkitTextStroke: "2px #8b5cf6",
      letterSpacing: 1,
    },
  },
];

const STAGE_META: Record<
  Exclude<ProcessStage, "idle">,
  { icon: string; label: string }
> = {
  uploading: { icon: "☁️", label: "Įkeliama..." },
  transcribing: { icon: "🎙️", label: "Transkribuojama..." },
  analyzing: { icon: "🧠", label: "Analizuojama..." },
  rendering: { icon: "🎞️", label: "Renderinama..." },
  done: { icon: "✅", label: "Video paruoštas!" },
};

const STAGES_ORDER: Exclude<ProcessStage, "idle">[] = [
  "uploading",
  "transcribing",
  "analyzing",
  "rendering",
  "done",
];

/* ───────────────────── helpers ───────────────────── */

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

/* ════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════ */

export default function DashboardPage() {
  /* ── file state ── */
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── features ── */
  const [features, setFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURES.map((f) => [f.id, f.defaultOn]))
  );

  /* ── caption style ── */
  const [captionStyle, setCaptionStyle] = useState("default");

  /* ── aspect ratio ── */
  const [aspect, setAspect] = useState<AspectRatio>("9:16");

  /* ── processing ── */
  const [stage, setStage] = useState<ProcessStage>("idle");
  const [stageProgress, setStageProgress] = useState(0);

  /* ── simulate upload progress when file selected ── */
  useEffect(() => {
    if (!file) return;
    setUploadProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
      }
      setUploadProgress(Math.min(100, Math.round(p)));
    }, 120);
    return () => clearInterval(iv);
  }, [file]);

  /* ── drag handlers ── */
  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      onDrag(e);
      setDragging(true);
    },
    [onDrag]
  );
  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      onDrag(e);
      setDragging(false);
    },
    [onDrag]
  );
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      onDrag(e);
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("video/")) {
        setFile(f);
        setStage("idle");
      }
    },
    [onDrag]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setStage("idle");
    }
  };

  const toggleFeature = (id: string) =>
    setFeatures((prev) => ({ ...prev, [id]: !prev[id] }));

  /* ── processing simulation ── */
  const startProcessing = () => {
    if (!file) return;
    setStage("uploading");
    setStageProgress(0);

    let idx = 0;
    const advance = () => {
      setStageProgress(0);
      setStage(STAGES_ORDER[idx]);

      let p = 0;
      const iv = setInterval(() => {
        p += Math.random() * 12 + 4;
        if (p >= 100) {
          p = 100;
          clearInterval(iv);
          idx++;
          if (idx < STAGES_ORDER.length) {
            setTimeout(advance, 350);
          }
        }
        setStageProgress(Math.min(100, Math.round(p)));
      }, 100);
    };
    advance();
  };

  const isProcessing = stage !== "idle" && stage !== "done";
  const isDone = stage === "done";
  const showFeatures = file && uploadProgress === 100;

  /* ══════════════════════════ JSX ══════════════════════════ */
  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-violet-500/30">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* logo */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                Cineflow
              </span>
            </span>
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-violet-400">
              Beta
            </span>
          </div>

          {/* nav */}
          <nav className="flex items-center gap-6 text-sm font-medium text-zinc-400">
            <button className="text-white transition hover:text-violet-400">
              Dashboard
            </button>
            <button className="transition hover:text-white">Projektai</button>
            <button className="transition hover:text-white">Nustatymai</button>
            <div className="ml-2 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* ─── UPLOAD ZONE ─── */}
        <section className="mb-12">
          <h2 className="mb-1 text-2xl font-semibold tracking-tight">
            Naujas projektas
          </h2>
          <p className="mb-6 text-sm text-zinc-500">
            Įkelk video ir leisk AI atlikti visą darbą
          </p>

          <div
            onDragEnter={onDragEnter}
            onDragOver={onDrag}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
              dragging
                ? "border-violet-500 bg-violet-500/10 shadow-[0_0_60px_-12px_rgba(139,92,246,0.35)]"
                : "border-white/10 bg-white/[0.03] hover:border-violet-500/50 hover:bg-white/[0.05]"
            } backdrop-blur-xl`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!file ? (
              /* ── empty state ── */
              <div className="flex flex-col items-center justify-center py-24">
                <div
                  className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border transition-all duration-300 ${
                    dragging
                      ? "border-violet-500/40 bg-violet-500/20"
                      : "border-white/10 bg-white/[0.05] group-hover:border-violet-500/30 group-hover:bg-violet-500/10"
                  }`}
                >
                  <svg
                    className={`h-8 w-8 transition-colors ${
                      dragging ? "text-violet-400" : "text-zinc-500 group-hover:text-violet-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="mb-2 text-lg font-medium">
                  Nutempk video čia
                </p>
                <p className="text-sm text-zinc-500">
                  arba{" "}
                  <span className="text-violet-400 underline underline-offset-2">
                    pasirink failą
                  </span>{" "}
                  · MP4, MOV, AVI iki 2 GB
                </p>
              </div>
            ) : (
              /* ── file selected ── */
              <div className="px-8 py-10">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {formatBytes(file.size)}
                    </p>
                    {/* progress */}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {uploadProgress < 100
                        ? `Įkeliama... ${uploadProgress}%`
                        : "✓ Failas paruoštas"}
                    </p>
                  </div>
                  {/* remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setStage("idle");
                      setUploadProgress(0);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        {showFeatures && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="mb-1 text-lg font-semibold tracking-tight">
              Funkcijos
            </h3>
            <p className="mb-5 text-sm text-zinc-500">
              Pasirink ką AI turėtų padaryti
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FEATURES.map((f) => {
                const on = features[f.id];
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className={`group relative overflow-hidden rounded-xl border p-4 text-left backdrop-blur-xl transition-all duration-200 ${
                      on
                        ? "border-violet-500/40 bg-violet-500/10 shadow-[0_0_30px_-8px_rgba(139,92,246,0.2)]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{f.emoji}</span>
                      {/* toggle pill */}
                      <div
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors duration-200 ${
                          on ? "bg-violet-500" : "bg-white/[0.12]"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            on ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{f.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── CAPTION STYLES ─── */}
        {showFeatures && features.subtitles && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="mb-1 text-lg font-semibold tracking-tight">
              Subtitrų stilius
            </h3>
            <p className="mb-5 text-sm text-zinc-500">
              Pasirink kaip atrodys subtitrai
            </p>

            <div className="grid grid-cols-5 gap-3">
              {CAPTION_STYLES.map((s) => {
                const selected = captionStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCaptionStyle(s.id)}
                    className={`group flex flex-col items-center justify-center rounded-xl border p-4 backdrop-blur-xl transition-all duration-200 ${
                      selected
                        ? "border-violet-500/50 bg-violet-500/10 shadow-[0_0_24px_-6px_rgba(139,92,246,0.25)]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex h-12 items-center justify-center">
                      <span style={s.style}>Aa</span>
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-zinc-400">
                      {s.label}
                    </p>
                    {selected && (
                      <div className="mt-1.5 h-1 w-4 rounded-full bg-violet-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── ASPECT RATIO ─── */}
        {showFeatures && (
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="mb-1 text-lg font-semibold tracking-tight">
              Aspect Ratio
            </h3>
            <p className="mb-5 text-sm text-zinc-500">
              Pasirink vaizdo formatą
            </p>

            <div className="flex gap-3">
              {(
                [
                  { value: "9:16" as AspectRatio, label: "9:16", sub: "Reels / TikTok", w: 28, h: 44 },
                  { value: "16:9" as AspectRatio, label: "16:9", sub: "YouTube", w: 48, h: 28 },
                  { value: "both" as AspectRatio, label: "Abu", sub: "9:16 + 16:9", w: 0, h: 0 },
                ] as const
              ).map((r) => {
                const selected = aspect === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setAspect(r.value)}
                    className={`flex flex-1 flex-col items-center rounded-xl border p-5 backdrop-blur-xl transition-all duration-200 ${
                      selected
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
                    }`}
                  >
                    {/* ratio preview */}
                    {r.value !== "both" ? (
                      <div
                        className={`mb-3 rounded-[4px] border transition-colors ${
                          selected ? "border-violet-400" : "border-white/20"
                        }`}
                        style={{ width: r.w, height: r.h }}
                      />
                    ) : (
                      <div className="mb-3 flex items-end gap-1.5">
                        <div
                          className={`rounded-[3px] border transition-colors ${
                            selected ? "border-violet-400" : "border-white/20"
                          }`}
                          style={{ width: 18, height: 28 }}
                        />
                        <div
                          className={`rounded-[3px] border transition-colors ${
                            selected ? "border-violet-400" : "border-white/20"
                          }`}
                          style={{ width: 32, height: 18 }}
                        />
                      </div>
                    )}
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {r.sub}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── PROCESS BUTTON / PROGRESS ─── */}
        {showFeatures && !isDone && (
          <section className="mb-16">
            {stage === "idle" ? (
              <button
                onClick={startProcessing}
                disabled={isProcessing}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-5 text-lg font-semibold shadow-[0_0_40px_-8px_rgba(139,92,246,0.5)] transition-all duration-300 hover:shadow-[0_0_60px_-8px_rgba(139,92,246,0.6)] active:scale-[0.98]"
              >
                <span className="relative z-10">🚀 Pradėti apdorojimą</span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ) : (
              /* progress stages */
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  {STAGES_ORDER.map((s, i) => {
                    const si = STAGES_ORDER.indexOf(stage as any);
                    const completed = i < si;
                    const active = s === stage;
                    return (
                      <div key={s} className="flex flex-1 flex-col items-center">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition-all duration-500 ${
                            completed
                              ? "border-green-500/40 bg-green-500/20"
                              : active
                              ? "border-violet-500/50 bg-violet-500/20 animate-pulse"
                              : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          {completed ? "✓" : STAGE_META[s].icon}
                        </div>
                        <p
                          className={`mt-2 text-xs font-medium ${
                            completed
                              ? "text-green-400"
                              : active
                              ? "text-white"
                              : "text-zinc-600"
                          }`}
                        >
                          {STAGE_META[s].label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* total progress bar */}
                <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ease-out"
                    style={{
                      width: `${
                        ((STAGES_ORDER.indexOf(stage as any) +
                          stageProgress / 100) /
                          STAGES_ORDER.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── DONE ─── */}
        {isDone && (
          <section className="mb-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/[0.06] p-10 text-center backdrop-blur-xl">
              <div className="mb-4 text-5xl">✅</div>
              <h3 className="mb-1 text-2xl font-bold">Video paruoštas!</h3>
              <p className="mb-6 text-sm text-zinc-400">
                Tavo video sėkmingai apdorotas ir paruoštas parsisiuntimui
              </p>
              <div className="flex items-center justify-center gap-3">
                <button className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 text-sm font-semibold shadow-[0_0_30px_-6px_rgba(34,197,94,0.4)] transition-all hover:shadow-[0_0_40px_-6px_rgba(34,197,94,0.5)] active:scale-[0.98]">
                  ⬇️ Parsisiųsti video
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setStage("idle");
                    setUploadProgress(0);
                    setFeatures(
                      Object.fromEntries(
                        FEATURES.map((f) => [f.id, f.defaultOn])
                      )
                    );
                    setCaptionStyle("default");
                    setAspect("9:16");
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-8 py-3 text-sm font-semibold transition hover:bg-white/[0.08]"
                >
                  🔄 Naujas projektas
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
