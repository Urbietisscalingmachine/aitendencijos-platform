"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import type { TimelineClip, TimelineState } from "@/types/cineflow";

/* ═══════════════════════════════════════════════════════════
   PLAYBACK PREVIEW — Video player + controls
   Syncs with timeline playhead, shows subtitles & overlays
   ═══════════════════════════════════════════════════════════ */

interface PlaybackPreviewProps {
  timeline: TimelineState;
  onSetTime: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
}

// ── Time format helper ──────────────────────────────────
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const f = Math.floor((secs % 1) * 30); // frame at 30fps
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

// ── Playback speed options ──────────────────────────────
const SPEEDS = [0.5, 1, 1.5, 2] as const;

export default function PlaybackPreview({
  timeline,
  onSetTime,
  onSetPlaying,
}: PlaybackPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active clips at current time
  const activeClips = timeline.clips.filter(
    (c) =>
      timeline.currentTime >= c.startTime &&
      timeline.currentTime < c.startTime + c.duration
  );

  const activeSubtitle = activeClips.find((c) => c.trackType === "subtitle");
  const activeEffect = activeClips.find((c) => c.trackType === "effect");
  const activeBroll = activeClips.find((c) => c.trackType === "broll");

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  // Seek bar click
  const handleSeek = useCallback(
    (e: React.MouseEvent) => {
      if (!seekRef.current) return;
      const rect = seekRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSetTime(ratio * timeline.duration);
    },
    [timeline.duration, onSetTime]
  );

  const progress = timeline.duration > 0 ? (timeline.currentTime / timeline.duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#09090b",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Video viewport ── */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {/* Placeholder canvas / video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ display: "none" }}
        />

        {/* Visual placeholder */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #8B5CF620, #8B5CF608)",
              border: "1px solid rgba(139,92,246,0.15)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="text-white/25 text-xs font-medium">Preview</span>
        </div>

        {/* B-Roll overlay indicator */}
        {activeBroll && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ backgroundColor: "rgba(52,211,153,0.2)", backdropFilter: "blur(8px)" }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-300 font-medium">
              B-Roll: {activeBroll.label || "Clip"}
            </span>
          </div>
        )}

        {/* Effect overlay indicator */}
        {activeEffect && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ backgroundColor: "rgba(244,114,182,0.2)", backdropFilter: "blur(8px)" }}>
            <span className="text-[10px] text-pink-300 font-medium">
              FX: {activeEffect.effectType || activeEffect.label || "Effect"}
            </span>
          </div>
        )}

        {/* Subtitle overlay */}
        {activeSubtitle && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-[80%]">
            <div
              className="px-4 py-2 rounded-lg text-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="text-white text-sm font-semibold leading-relaxed">
                {activeSubtitle.label || "Subtitle text"}
              </span>
            </div>
          </div>
        )}

        {/* Timecode overlay */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <span className="text-[10px] font-mono text-white/70">
            {formatTime(timeline.currentTime)}
          </span>
        </div>
      </div>

      {/* ── Seek bar ── */}
      <div
        ref={seekRef}
        className="h-2 cursor-pointer group relative"
        style={{ backgroundColor: "#1a1a2e" }}
        onClick={handleSeek}
      >
        {/* Progress */}
        <div
          className="h-full transition-[width] duration-75"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg
                     opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* ── Controls bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: "#0d0d15",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Left: playback controls */}
        <div className="flex items-center gap-2">
          {/* Stop */}
          <button
            onClick={() => { onSetPlaying(false); onSetTime(0); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title="Stop"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="1" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => onSetPlaying(!timeline.playing)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all
                       hover:scale-105 active:scale-95"
            style={{
              background: timeline.playing
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #8B5CF6, #7C3AED)",
              boxShadow: timeline.playing
                ? "0 0 20px rgba(239,68,68,0.3)"
                : "0 0 20px rgba(139,92,246,0.3)",
            }}
            title={timeline.playing ? "Pause (Space)" : "Play (Space)"}
          >
            {timeline.playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21" />
              </svg>
            )}
          </button>
        </div>

        {/* Center: time display */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-white/90 text-sm font-mono font-semibold">
              {formatTime(timeline.currentTime)}
            </span>
            <span className="text-white/25 text-xs">/</span>
            <span className="text-white/40 text-xs font-mono">
              {formatTime(timeline.duration)}
            </span>
          </div>

          {/* Frame counter */}
          <div className="px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-[10px] text-white/40 font-mono">
              F{Math.floor(timeline.currentTime * 30)}
            </span>
          </div>
        </div>

        {/* Right: speed + fullscreen */}
        <div className="flex items-center gap-2">
          {/* Speed selector */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-2 py-1 text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor: speed === s ? "#8B5CF6" : "transparent",
                  color: speed === s ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title="Fullscreen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen ? (
                <>
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              ) : (
                <>
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
