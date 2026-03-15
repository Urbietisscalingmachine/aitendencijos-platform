"use client";

import React, { useRef, useCallback, useMemo } from "react";
import type { TimelineClip, TrackType } from "@/types/cineflow";

/* ═══════════════════════════════════════════════════════════
   TIMELINE TRACK — Individual track row
   Shows clips as colored blocks with waveform/text/thumb
   ═══════════════════════════════════════════════════════════ */

// ── Track visual config ─────────────────────────────────
export const TRACK_CONFIG: Record<
  TrackType,
  {
    label: string;
    color: string;
    gradient: string;
    icon: React.ReactNode;
  }
> = {
  video: {
    label: "Video",
    color: "#8B5CF6",
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
        <line x1="17" y1="17" x2="22" y2="17" />
      </svg>
    ),
  },
  audio: {
    label: "Audio",
    color: "#22D3EE",
    gradient: "linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  subtitle: {
    label: "Subtitles",
    color: "#FBBF24",
    gradient: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  broll: {
    label: "B-Roll",
    color: "#34D399",
    gradient: "linear-gradient(135deg, #34D399 0%, #059669 100%)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  effect: {
    label: "Effects",
    color: "#F472B6",
    gradient: "linear-gradient(135deg, #F472B6 0%, #EC4899 100%)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
};

// ── Types ────────────────────────────────────────────────
interface TimelineTrackProps {
  trackType: TrackType;
  trackIndex: number;
  clips: TimelineClip[];
  zoom: number;
  pixelsPerSecond: number;
  selectedClipIds: Set<string>;
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
  volume: number;
  onClipMouseDown: (e: React.MouseEvent, clip: TimelineClip, edge: "left" | "right" | "body") => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onToggleLock: () => void;
  onVolumeChange: (v: number) => void;
  onTrackDrop: (e: React.DragEvent) => void;
  onTrackDragOver: (e: React.DragEvent) => void;
}

// ── Fake waveform bars ──────────────────────────────────
function WaveformBars({ width, color }: { width: number; color: string }) {
  const bars = useMemo(() => {
    const count = Math.max(1, Math.floor(width / 3));
    const result: number[] = [];
    // Deterministic pseudo-random waveform
    let seed = 42;
    for (let i = 0; i < count; i++) {
      seed = (seed * 16807 + 7) % 2147483647;
      result.push(0.15 + (seed % 100) / 120);
    }
    return result;
  }, [width]);

  return (
    <div className="flex items-center gap-[1px] h-full px-1 overflow-hidden">
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: "2px",
            height: `${h * 100}%`,
            backgroundColor: color,
            opacity: 0.6,
            borderRadius: "1px",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ── Clip Component ──────────────────────────────────────
function ClipBlock({
  clip,
  pixelsPerSecond,
  selected,
  config,
  onMouseDown,
}: {
  clip: TimelineClip;
  pixelsPerSecond: number;
  selected: boolean;
  config: (typeof TRACK_CONFIG)[TrackType];
  onMouseDown: (e: React.MouseEvent, edge: "left" | "right" | "body") => void;
}) {
  const left = clip.startTime * pixelsPerSecond;
  const width = Math.max(clip.duration * pixelsPerSecond, 8);

  return (
    <div
      className="absolute top-[4px] bottom-[4px] rounded-lg cursor-grab active:cursor-grabbing group select-none"
      style={{
        left,
        width,
        background: config.gradient,
        boxShadow: selected
          ? `0 0 0 2px #fff, 0 0 12px ${config.color}80`
          : `0 2px 8px ${config.color}30`,
        opacity: selected ? 1 : 0.88,
        transition: "box-shadow 0.15s, opacity 0.15s",
        zIndex: selected ? 10 : 1,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, "body");
      }}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[6px] cursor-col-resize z-20 
                   opacity-0 group-hover:opacity-100 transition-opacity
                   rounded-l-lg"
        style={{ backgroundColor: "rgba(255,255,255,0.35)" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown(e, "left");
        }}
      />

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize z-20
                   opacity-0 group-hover:opacity-100 transition-opacity
                   rounded-r-lg"
        style={{ backgroundColor: "rgba(255,255,255,0.35)" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown(e, "right");
        }}
      />

      {/* Content area */}
      <div className="relative h-full overflow-hidden rounded-lg px-1.5 flex items-center">
        {/* Waveform for audio */}
        {clip.trackType === "audio" && <WaveformBars width={width} color="#fff" />}

        {/* Subtitle text preview */}
        {clip.trackType === "subtitle" && (
          <span
            className="text-[10px] font-medium text-white/90 truncate leading-none"
            title={clip.label}
          >
            {clip.label || "Subtitle"}
          </span>
        )}

        {/* Video/broll thumbnail placeholder */}
        {(clip.trackType === "video" || clip.trackType === "broll") && (
          <div className="flex items-center gap-1 overflow-hidden">
            <div className="w-8 h-8 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity="0.6">
                <polygon points="5 3 19 12 5 21" />
              </svg>
            </div>
            {width > 70 && (
              <span className="text-[10px] text-white/80 truncate">
                {clip.label || (clip.trackType === "video" ? "Video" : "B-Roll")}
              </span>
            )}
          </div>
        )}

        {/* Effect label */}
        {clip.trackType === "effect" && (
          <span className="text-[10px] font-medium text-white/90 truncate">
            {clip.effectType || clip.label || "FX"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Track Component ────────────────────────────────
export default function TimelineTrack({
  trackType,
  trackIndex,
  clips,
  zoom,
  pixelsPerSecond,
  selectedClipIds,
  isMuted,
  isSolo,
  isLocked,
  volume,
  onClipMouseDown,
  onToggleMute,
  onToggleSolo,
  onToggleLock,
  onVolumeChange,
  onTrackDrop,
  onTrackDragOver,
}: TimelineTrackProps) {
  const config = TRACK_CONFIG[trackType];
  const trackRef = useRef<HTMLDivElement>(null);
  const isAudio = trackType === "audio";

  const handleClipMD = useCallback(
    (clip: TimelineClip) => (e: React.MouseEvent, edge: "left" | "right" | "body") => {
      if (isLocked) return;
      onClipMouseDown(e, clip, edge);
    },
    [isLocked, onClipMouseDown]
  );

  return (
    <div
      className="flex h-[60px] border-b border-white/[0.06]"
      style={{ opacity: isMuted ? 0.45 : 1, transition: "opacity 0.2s" }}
    >
      {/* ── Track header (left panel) ── */}
      <div
        className="w-[180px] flex-shrink-0 flex items-center gap-2 px-3 border-r border-white/[0.06]"
        style={{ backgroundColor: "#0f0f1a" }}
      >
        {/* Icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${config.color}25`, color: config.color }}
        >
          {config.icon}
        </div>

        {/* Label */}
        <span className="text-[11px] font-semibold text-white/80 flex-1 truncate">
          {config.label}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors"
            style={{
              backgroundColor: isMuted ? "#ef4444" : "transparent",
              color: isMuted ? "#fff" : "rgba(255,255,255,0.4)",
            }}
            title="Mute"
          >
            M
          </button>
          {/* Solo */}
          <button
            onClick={onToggleSolo}
            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors"
            style={{
              backgroundColor: isSolo ? "#FBBF24" : "transparent",
              color: isSolo ? "#000" : "rgba(255,255,255,0.4)",
            }}
            title="Solo"
          >
            S
          </button>
          {/* Lock */}
          <button
            onClick={onToggleLock}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{
              color: isLocked ? "#ef4444" : "rgba(255,255,255,0.3)",
            }}
            title="Lock"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isLocked ? (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </>
              ) : (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Volume slider (audio only) */}
        {isAudio && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-12 h-1 accent-cyan-400 cursor-pointer ml-0.5"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        )}
      </div>

      {/* ── Track body (clips area) ── */}
      <div
        ref={trackRef}
        className="flex-1 relative overflow-visible"
        style={{ backgroundColor: "#1a1a2e" }}
        onDrop={onTrackDrop}
        onDragOver={onTrackDragOver}
      >
        {/* Grid lines (subtle) */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 0px,
            rgba(255,255,255,0.03) 1px,
            transparent 1px,
            transparent ${pixelsPerSecond}px
          )`,
        }} />

        {/* Clips */}
        {clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            pixelsPerSecond={pixelsPerSecond}
            selected={selectedClipIds.has(clip.id)}
            config={config}
            onMouseDown={handleClipMD(clip)}
          />
        ))}

        {/* Empty state */}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-white/15 italic">
              Drop {config.label.toLowerCase()} here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
