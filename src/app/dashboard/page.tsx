"use client";

/* ═══════════════════════════════════════════════════════════
   CINEFLOW DASHBOARD — 3-Step Workflow
   Step 1: Upload → Step 2: Editing Mode → Step 3: Editor
   ═══════════════════════════════════════════════════════════ */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useReducer,
} from "react";

// ── Components ──────────────────────────────────────────
import SubtitlesEngine from "@/components/SubtitlesEngine";
import PlaybackPreview from "@/components/PlaybackPreview";
import BrollEngine from "@/components/BrollEngine";
import EffectsEngine from "@/components/EffectsEngine";
import AudioEngine from "@/components/AudioEngine";
import TimelineTrack, { TRACK_CONFIG } from "@/components/TimelineTrack";
import ExportModalComponent from "@/components/ExportModal";

// ── Utilities ───────────────────────────────────────────
import { extractAudioForWhisper } from "@/lib/extract-audio-ffmpeg";

// ── Types ───────────────────────────────────────────────
import type {
  TranscriptSegment,
  CaptionStyle,
  TimelineState,
  TimelineClip,
  TimelineAction,
  TrackType,
  AudioSettings,
  BrollClip,
  BrollSuggestion,
  EffectKeyframe,
  EffectType,
  MusicTrack,
  NoiseRemovalSettings,
  SilenceSegment,
  AspectRatioPreset,
  AspectRatioOption,
  CropPosition,
} from "@/types/cineflow";

// ═════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════

const ACCENT = "#8B5CF6";
const BG = "#09090b";
const PANEL = "#111113";
const BORDER = "rgba(255,255,255,0.08)";
const TRACKS: TrackType[] = ["video", "audio", "subtitle", "broll", "effect"];
const BASE_PPS = 60;
const SNAP_THRESHOLD_PX = 6;
const MAX_HISTORY = 50;
const FRAME_DURATION = 1 / 30;

// ── Aspect Ratio Presets ─────────────────────────────
const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: "auto", label: "Auto", icon: "🎥", ratio: 0 },
  { id: "9:16", label: "Reels/TikTok", icon: "📱", ratio: 9 / 16 },
  { id: "16:9", label: "YouTube", icon: "🖥️", ratio: 16 / 9 },
  { id: "1:1", label: "Instagram", icon: "⬜", ratio: 1 },
  { id: "4:5", label: "IG Feed", icon: "📷", ratio: 4 / 5 },
  { id: "4:3", label: "Classic", icon: "📺", ratio: 4 / 3 },
  { id: "21:9", label: "Cinematic", icon: "🎬", ratio: 21 / 9 },
];

// ── Speed Presets ────────────────────────────────────
const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

// ═════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════

type Step = 1 | 2 | 3;
type EditingMode = "ai-full-auto" | "reference-clone" | "subtitles-only" | null;
type AIDetailLevel = "quick" | "standard" | "premium";
type BrollModel = "kling-3.0" | "sora-2" | "veo-3.1";
type RightPanelTab = "subtitles" | "broll" | "effects" | "audio";

interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

interface UploadedFile {
  file: File;
  url: string;
  name: string;
  size: number;
  duration: number;
}

// ═════════════════════════════════════════════════════════
// KEYFRAMES CSS (injected once)
// ═════════════════════════════════════════════════════════

const DRAFT_KEY = "cineflow-draft";

const GLOBAL_STYLES = `
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.15); } 50% { box-shadow: 0 0 40px rgba(139,92,246,0.35); } }
@keyframes slide-up { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes check-pop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes saved-fade-in { 0% { opacity: 0; transform: translateY(-4px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes saved-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
`;

// ═════════════════════════════════════════════════════════
// TIMELINE REDUCER (with undo/redo)
// ═════════════════════════════════════════════════════════

function timelineReducer(
  state: TimelineState,
  action: TimelineAction
): TimelineState {
  switch (action.type) {
    case "ADD_CLIP":
      return {
        ...state,
        clips: [...state.clips, action.clip],
        duration: Math.max(
          state.duration,
          action.clip.startTime + action.clip.duration
        ),
      };
    case "REMOVE_CLIP":
      return {
        ...state,
        clips: state.clips.filter((c) => c.id !== action.clipId),
      };
    case "MOVE_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId
            ? { ...c, startTime: Math.max(0, action.startTime), trackIndex: action.trackIndex }
            : c
        ),
      };
    case "TRIM_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId
            ? { ...c, startTime: Math.max(0, action.startTime), duration: Math.max(0.1, action.duration) }
            : c
        ),
      };
    case "SPLIT_CLIP": {
      const clip = state.clips.find((c) => c.id === action.clipId);
      if (!clip) return state;
      const splitPoint = action.splitAt;
      if (splitPoint <= clip.startTime || splitPoint >= clip.startTime + clip.duration) return state;
      const leftDur = splitPoint - clip.startTime;
      const rightDur = clip.duration - leftDur;
      const leftClip: TimelineClip = { ...clip, duration: leftDur };
      const rightClip: TimelineClip = {
        ...clip,
        id: clip.id + "_R" + Date.now(),
        startTime: splitPoint,
        duration: rightDur,
        sourceStart: (clip.sourceStart ?? 0) + leftDur,
        trimStart: (clip.trimStart ?? 0) + leftDur,
      };
      return {
        ...state,
        clips: state.clips.map((c) => (c.id === clip.id ? leftClip : c)).concat(rightClip),
      };
    }
    case "UPDATE_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId ? { ...c, ...action.changes } : c
        ),
      };
    case "SET_TIME":
      return { ...state, currentTime: Math.max(0, Math.min(action.time, state.duration)) };
    case "SET_PLAYING":
      return { ...state, playing: action.playing };
    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(10, action.zoom)) };
    default:
      return state;
  }
}

interface HistoryState {
  past: TimelineState[];
  present: TimelineState;
  future: TimelineState[];
}

function historyReducer(hist: HistoryState, action: TimelineAction): HistoryState {
  if (action.type === "UNDO") {
    if (hist.past.length === 0) return hist;
    const prev = hist.past[hist.past.length - 1];
    return { past: hist.past.slice(0, -1), present: prev, future: [hist.present, ...hist.future].slice(0, MAX_HISTORY) };
  }
  if (action.type === "REDO") {
    if (hist.future.length === 0) return hist;
    const next = hist.future[0];
    return { past: [...hist.past, hist.present].slice(-MAX_HISTORY), present: next, future: hist.future.slice(1) };
  }
  if (action.type === "SET_TIME" || action.type === "SET_PLAYING" || action.type === "SET_ZOOM") {
    return { ...hist, present: timelineReducer(hist.present, action) };
  }
  const newPresent = timelineReducer(hist.present, action);
  return { past: [...hist.past, hist.present].slice(-MAX_HISTORY), present: newPresent, future: [] };
}

const EMPTY_TIMELINE: TimelineState = {
  clips: [],
  tracks: TRACKS,
  duration: 30,
  currentTime: 0,
  zoom: 1,
  playing: false,
};

// ═════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════

let _uid = 0;
function uid(prefix = "clip") {
  return `${prefix}-${Date.now()}-${++_uid}`;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}

// ═════════════════════════════════════════════════════════
// STEP PROGRESS BAR COMPONENT
// ═════════════════════════════════════════════════════════

function StepIndicator({ currentStep, onStepClick }: { currentStep: Step; onStepClick: (s: Step) => void }) {
  const steps = [
    { num: 1 as Step, label: "Upload", icon: "📂" },
    { num: 2 as Step, label: "Mode", icon: "🎛️" },
    { num: 3 as Step, label: "Editor", icon: "✂️" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "16px 24px" }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.num}>
          {/* Step circle + label */}
          <button
            onClick={() => {
              if (step.num < currentStep) onStepClick(step.num);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: step.num < currentStep ? "pointer" : "default",
              opacity: step.num <= currentStep ? 1 : 0.35,
              transition: "all 0.3s",
              padding: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                background:
                  step.num === currentStep
                    ? `linear-gradient(135deg, ${ACCENT}, #7C3AED)`
                    : step.num < currentStep
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  step.num === currentStep
                    ? ACCENT
                    : step.num < currentStep
                      ? "rgba(34,197,94,0.3)"
                      : BORDER
                }`,
                boxShadow: step.num === currentStep ? `0 0 20px rgba(139,92,246,0.3)` : "none",
                transition: "all 0.3s",
              }}
            >
              {step.num < currentStep ? (
                <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
              ) : (
                <span>{step.icon}</span>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: step.num === currentStep ? "#fff" : step.num < currentStep ? "#22c55e" : "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {step.label}
            </span>
          </button>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              style={{
                width: 80,
                height: 2,
                borderRadius: 1,
                marginBottom: 20,
                background:
                  step.num < currentStep
                    ? `linear-gradient(90deg, #22c55e, ${i === 0 && currentStep === 2 ? ACCENT : "#22c55e"})`
                    : step.num === currentStep
                      ? `linear-gradient(90deg, ${ACCENT}, rgba(255,255,255,0.08))`
                      : "rgba(255,255,255,0.08)",
                transition: "all 0.3s",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// MODE CARD COMPONENT
// ═════════════════════════════════════════════════════════

function ModeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 220,
        padding: "28px 24px",
        borderRadius: 20,
        border: `1px solid ${selected ? ACCENT : hovered ? "rgba(139,92,246,0.4)" : BORDER}`,
        background: selected
          ? "rgba(139,92,246,0.08)"
          : hovered
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.015)",
        backdropFilter: "blur(20px)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.3s ease",
        boxShadow: selected
          ? `0 0 30px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)`
          : hovered
            ? `0 0 20px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.03)`
            : "inset 0 1px 0 rgba(255,255,255,0.03)",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 14 }}>{icon}</div>
      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#fff",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.5)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </button>
  );
}

// ═════════════════════════════════════════════════════════
// AI DETAIL LEVEL SELECTOR
// ═════════════════════════════════════════════════════════

function DetailLevelSelector({
  value,
  onChange,
}: {
  value: AIDetailLevel;
  onChange: (v: AIDetailLevel) => void;
}) {
  const levels: { id: AIDetailLevel; icon: string; label: string; desc: string }[] = [
    { id: "quick", icon: "🚀", label: "Quick", desc: "Subtitrai + silence removal" },
    { id: "standard", icon: "⚡", label: "Standard", desc: "Subtitrai + B-roll + muzika" },
    { id: "premium", icon: "💎", label: "Premium", desc: "Viskas: subtitrai + B-roll + zoom + muzika + efektai + SFX" },
  ];

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {levels.map((lvl) => (
        <button
          key={lvl.id}
          onClick={() => onChange(lvl.id)}
          style={{
            flex: 1,
            padding: "14px 12px",
            borderRadius: 14,
            border: `1px solid ${value === lvl.id ? ACCENT : BORDER}`,
            background: value === lvl.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>{lvl.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: value === lvl.id ? "#fff" : "rgba(255,255,255,0.7)", marginBottom: 4 }}>
            {lvl.label}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{lvl.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// B-ROLL MODEL SELECTOR
// ═════════════════════════════════════════════════════════

function BrollModelSelector({
  value,
  onChange,
}: {
  value: BrollModel;
  onChange: (v: BrollModel) => void;
}) {
  const models: { id: BrollModel; icon: string; name: string; tag: string }[] = [
    { id: "kling-3.0", icon: "🎬", name: "Kling 3.0", tag: "Fast" },
    { id: "sora-2", icon: "✨", name: "Sora 2", tag: "Premium" },
    { id: "veo-3.1", icon: "🎥", name: "Veo 3.1", tag: "Best" },
  ];

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{
            flex: 1,
            padding: "10px 8px",
            borderRadius: 10,
            border: `1px solid ${value === m.id ? ACCENT : BORDER}`,
            background: value === m.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: value === m.id ? "#fff" : "rgba(255,255,255,0.6)" }}>
            {m.name}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginTop: 2,
              opacity: value === m.id ? 1 : 0.5,
            }}
          >
            {m.tag}
          </div>
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// ASPECT RATIO SELECTOR COMPONENT
// ═════════════════════════════════════════════════════════

function AspectRatioSelector({
  value,
  onChange,
}: {
  value: AspectRatioPreset;
  onChange: (v: AspectRatioPreset) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {ASPECT_RATIOS.filter((a) => a.id !== "auto").map((ar) => (
        <button
          key={ar.id}
          onClick={() => onChange(ar.id)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${value === ar.id ? ACCENT : BORDER}`,
            background: value === ar.id ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            minWidth: 64,
          }}
        >
          <span style={{ fontSize: 18 }}>{ar.icon}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: value === ar.id ? "#fff" : "rgba(255,255,255,0.6)",
            }}
          >
            {ar.id}
          </span>
          <span
            style={{
              fontSize: 9,
              color: value === ar.id ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.3)",
              lineHeight: 1.2,
            }}
          >
            {ar.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// SPEED CONTROL COMPONENT
// ═════════════════════════════════════════════════════════

function SpeedControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginRight: 4 }}>
        Speed:
      </span>
      {SPEED_PRESETS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${value === s ? ACCENT : BORDER}`,
            background: value === s ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)",
            color: value === s ? "#fff" : "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            minWidth: 36,
          }}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// PROCESSING VIEW COMPONENT
// ═════════════════════════════════════════════════════════

function ProcessingView({
  videoUrl,
  steps,
  errors,
}: {
  videoUrl: string;
  steps: ProcessingStep[];
  errors?: string[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 32,
        alignItems: "flex-start",
        justifyContent: "center",
        maxWidth: 900,
        width: "100%",
        margin: "0 auto",
        padding: "0 24px",
      }}
    >
      {/* Left: video preview */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
          background: "#000",
        }}
      >
        <video
          src={videoUrl}
          style={{ width: "100%", display: "block", borderRadius: 16 }}
          muted
          autoPlay
          loop
          playsInline
        />
      </div>

      {/* Right: progress steps */}
      <div
        style={{
          flex: 1,
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
          Apdorojama...
        </h3>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${step.status === "active" ? "rgba(139,92,246,0.3)" : BORDER}`,
              background: step.status === "active" ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.015)",
              transition: "all 0.4s ease",
              animation: step.status === "done" ? "slide-up 0.3s ease" : undefined,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                flexShrink: 0,
                background:
                  step.status === "done"
                    ? "rgba(34,197,94,0.15)"
                    : step.status === "active"
                      ? "rgba(139,92,246,0.15)"
                      : step.status === "error"
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(255,255,255,0.04)",
                transition: "all 0.3s",
              }}
            >
              {step.status === "done" && <span style={{ color: "#22c55e", animation: "check-pop 0.3s ease" }}>✓</span>}
              {step.status === "active" && (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(139,92,246,0.3)",
                    borderTopColor: ACCENT,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              )}
              {step.status === "error" && <span style={{ color: "#ef4444" }}>✕</span>}
              {step.status === "pending" && <span style={{ color: "rgba(255,255,255,0.15)" }}>○</span>}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  step.status === "done"
                    ? "#22c55e"
                    : step.status === "active"
                      ? "#fff"
                      : step.status === "error"
                        ? "#ef4444"
                        : "rgba(255,255,255,0.25)",
                transition: "color 0.3s",
              }}
            >
              {step.label}
            </span>
          </div>
        ))}

        {/* Error summary */}
        {errors && errors.length > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.06)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>
              ⚠️ Klaidos:
            </div>
            {errors.map((err, i) => (
              <div key={i} style={{ fontSize: 11, color: "rgba(239,68,68,0.8)", lineHeight: 1.6 }}>
                • {err}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═════════════════════════════════════════════════════════

export default function CineflowDashboard() {
  // ── Step state ─────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Upload state ───────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // ── Step 2 state ───────────────────────────────────
  const [editingMode, setEditingMode] = useState<EditingMode>(null);
  const [expandedMode, setExpandedMode] = useState<EditingMode>(null);
  const [aiDetailLevel, setAiDetailLevel] = useState<AIDetailLevel>("standard");
  const [brollModel, setBrollModel] = useState<BrollModel>("kling-3.0");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle | null>(null);

  // ── Reference clone state ──────────────────────────
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [referenceScreenshot, setReferenceScreenshot] = useState("");
  const [youtubeRefUrl, setYoutubeRefUrl] = useState("");
  const refVideoInputRef = useRef<HTMLInputElement>(null);
  const refScreenshotInputRef = useRef<HTMLInputElement>(null);

  // ── Processing state ───────────────────────────────
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);

  // ── Editor state ───────────────────────────────────
  const [activeTab, setActiveTab] = useState<RightPanelTab>("subtitles");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // ── Aspect Ratio & Crop state ─────────────────────
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>("auto");
  const [cropPosition, setCropPosition] = useState<CropPosition>({ x: 0, y: 0, scale: 1 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const cropDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [nativeVideoRatio, setNativeVideoRatio] = useState<number>(16 / 9);

  // ── Speed Control state ───────────────────────────
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // ── Transcript ─────────────────────────────────────
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [brollSuggestions, setBrollSuggestions] = useState<BrollSuggestion[]>([]);
  const [zoomMoments, setZoomMoments] = useState<{ timestamp: number; word: string; type: string }[]>([]);
  const [suggestedMusic, setSuggestedMusic] = useState<{ genre: string; mood: string } | null>(null);
  const [fetchedBrollClips, setFetchedBrollClips] = useState<{ suggestion: BrollSuggestion; clips: BrollClip[] }[]>([]);
  const [fetchedMusicTrack, setFetchedMusicTrack] = useState<MusicTrack | null>(null);
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);

  // ── Audio ──────────────────────────────────────────
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    videoVolume: 1,
    musicVolume: 0.5,
    duckingLevel: 0.2,
    fadeInDuration: 1,
    fadeOutDuration: 2,
    silenceThreshold: -40,
    silenceAction: "cut",
    silenceSpeedMultiplier: 3,
  });

  // ── Noise Removal Audio Chain ─────────────────────
  const [noiseRemovalSettings, setNoiseRemovalSettings] = useState<NoiseRemovalSettings>({
    enabled: false,
    preset: "medium",
    highpassFreq: 80,
    lowpassFreq: 12000,
    gateThreshold: -50,
    voiceBoost: 3,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const noiseChainRef = useRef<{
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    voiceBoost: BiquadFilterNode;
  } | null>(null);

  // ── Timeline (with undo/redo) ──────────────────────
  const [hist, dispatch] = useReducer(historyReducer, {
    past: [],
    present: EMPTY_TIMELINE,
    future: [],
  });
  const timeline = hist.present;

  // ── Timeline UI state ──────────────────────────────
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [editingSubtitleId, setEditingSubtitleId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [trackMetas, setTrackMetas] = useState<
    Record<number, { muted: boolean; solo: boolean; locked: boolean; volume: number }>
  >(() => {
    const m: Record<number, { muted: boolean; solo: boolean; locked: boolean; volume: number }> = {};
    TRACKS.forEach((_, i) => (m[i] = { muted: false, solo: false, locked: false, volume: 0.8 }));
    return m;
  });

  // ── Resize state ───────────────────────────────────
  const [previewWidth, setPreviewWidth] = useState(60);
  const [timelineHeight, setTimelineHeight] = useState(280);
  const isResizingH = useRef(false);
  const isResizingV = useRef(false);

  // ── Refs ───────────────────────────────────────────
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{
    clipId: string;
    edge: "left" | "right" | "body";
    startX: number;
    startY: number;
    origStart: number;
    origDuration: number;
    origTrackIndex: number;
  } | null>(null);
  const editorVideoRef = useRef<HTMLVideoElement>(null);

  // ── Active Effects State (video preview CSS) ──────
  const [activeFilterCSS, setActiveFilterCSS] = useState<string>("");
  const [activeFilterOverlay, setActiveFilterOverlay] = useState<React.CSSProperties | null>(null);
  const [activeZoomCSS, setActiveZoomCSS] = useState<string>("");
  const [activeZoomTransition, setActiveZoomTransition] = useState<string>("");

  // ── Mobile Responsive ──────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<RightPanelTab>("subtitles");

  // ── Auto-Save / Draft System ───────────────────────
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ═════════════════════════════════════════════════════
  // INJECT GLOBAL STYLES
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    const id = "cineflow-keyframes";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_STYLES;
      document.head.appendChild(style);
    }
  }, []);

  // ═════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ═════════════════════════════════════════════════════
  // AUTO-SAVE / DRAFT SYSTEM
  // ═════════════════════════════════════════════════════

  const saveDraft = useCallback(() => {
    const draft = {
      projectName,
      mode: editingMode,
      captionStyle,
      timeline: { clips: timeline.clips, duration: timeline.duration },
      transcript,
      videoName: uploadedFile?.name,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setLastSavedTime(Date.now());
      setShowSavedIndicator(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setShowSavedIndicator(false), 2000);
    } catch (e) {
      console.error("[auto-save] Failed:", e);
    }
  }, [projectName, editingMode, captionStyle, timeline.clips, timeline.duration, transcript, uploadedFile]);

  // Auto-save every 30s when in editor (step 3)
  useEffect(() => {
    if (currentStep !== 3) return;
    const interval = setInterval(saveDraft, 30000);
    return () => clearInterval(interval);
  }, [currentStep, saveDraft]);

  // Ctrl+S / Cmd+S manual save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        if (currentStep === 3) saveDraft();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentStep, saveDraft]);

  // Check for draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        const age = Date.now() - draft.savedAt;
        if (age < 24 * 60 * 60 * 1000) {
          setPendingDraft(draft);
          setShowDraftDialog(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch (e) {
      console.error("[draft-restore] Failed to parse draft:", e);
    }
  }, []);

  // Restore draft function
  const restoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    const d = pendingDraft;
    if (d.projectName) setProjectName(d.projectName as string);
    if (d.mode) setEditingMode(d.mode as EditingMode);
    if (d.captionStyle) setCaptionStyle(d.captionStyle as CaptionStyle);
    if (d.transcript) setTranscript(d.transcript as TranscriptSegment[]);

    // Restore timeline clips
    const tl = d.timeline as { clips?: TimelineClip[]; duration?: number } | undefined;
    if (tl && tl.clips && tl.clips.length > 0) {
      tl.clips.forEach((clip: TimelineClip) => {
        dispatch({ type: "ADD_CLIP", clip });
      });
    }

    setShowDraftDialog(false);
    setPendingDraft(null);
    // Note: can't restore video file (blob URLs don't persist), user will need to re-upload
    // but we jump to step 1 so they can re-upload and proceed
  }, [pendingDraft]);

  const dismissDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, []);

  // ═════════════════════════════════════════════════════
  // DERIVED VALUES
  // ═════════════════════════════════════════════════════

  const pixelsPerSecond = BASE_PPS * timeline.zoom;
  const totalWidth = timeline.duration * pixelsPerSecond;

  const clipsPerTrack = useMemo(() => {
    const map: Record<number, TimelineClip[]> = {};
    TRACKS.forEach((_, i) => (map[i] = []));
    timeline.clips.forEach((c) => {
      const idx = c.trackIndex;
      if (map[idx]) map[idx].push(c);
    });
    return map;
  }, [timeline.clips]);

  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; major: boolean }[] = [];
    let interval = 5;
    if (pixelsPerSecond > 100) interval = 1;
    if (pixelsPerSecond > 200) interval = 0.5;
    if (pixelsPerSecond < 30) interval = 10;
    for (let t = 0; t <= timeline.duration; t += interval) {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      marks.push({ time: t, label: `${m}:${s.toString().padStart(2, "0")}`, major: true });
    }
    return marks;
  }, [timeline.duration, pixelsPerSecond]);

  // Active subtitle for real-time overlay — find from transcript for smoother updates
  const activeSubtitle = useMemo(() => {
    return timeline.clips.find(
      (c) =>
        c.trackType === "subtitle" &&
        timeline.currentTime >= c.startTime &&
        timeline.currentTime < c.startTime + c.duration
    );
  }, [timeline.clips, timeline.currentTime]);

  // Active B-Roll clip for overlay on video preview
  const activeBroll = useMemo(() => {
    return timeline.clips.find(
      (c) =>
        c.trackType === "broll" &&
        c.src &&
        timeline.currentTime >= c.startTime &&
        timeline.currentTime < c.startTime + c.duration
    );
  }, [timeline.clips, timeline.currentTime]);

  // Active effect clip for real-time filter/zoom from timeline
  const activeEffectClip = useMemo(() => {
    return timeline.clips.find(
      (c) =>
        c.trackType === "effect" &&
        c.effectType &&
        timeline.currentTime >= c.startTime &&
        timeline.currentTime < c.startTime + c.duration
    );
  }, [timeline.clips, timeline.currentTime]);

  // Auto-apply filter/zoom from active timeline effect clips
  useEffect(() => {
    if (!activeEffectClip) return; // Don't clear — manual selections should persist
    const params = activeEffectClip.effectParams || {};
    const cssFilter = params.cssFilter as string | undefined;
    const cssTransform = params.cssTransform as string | undefined;
    const cssTransition = params.cssTransition as string | undefined;

    if (cssFilter && cssFilter !== "none") {
      setActiveFilterCSS(cssFilter);
    }
    if (cssTransform) {
      setActiveZoomCSS(cssTransform);
      if (cssTransition) setActiveZoomTransition(cssTransition);
    }
  }, [activeEffectClip]);

  // ── Detect native video ratio ───────────────────────
  const handleVideoLoadedMetadata = useCallback(() => {
    const v = editorVideoRef.current;
    if (v && v.videoWidth && v.videoHeight) {
      setNativeVideoRatio(v.videoWidth / v.videoHeight);
    }
  }, []);

  // Sync timeline currentTime from video timeupdate for smoother subtitle tracking
  const handleVideoTimeUpdate = useCallback(() => {
    if (editorVideoRef.current && !timeline.playing) {
      // Only sync if user seeked the video directly (not when timeline drives playback)
    }
  }, [timeline.playing]);

  // ── Compute target aspect ratio number ────────────
  const targetAspectRatio = useMemo(() => {
    if (aspectRatio === "auto") return nativeVideoRatio;
    const preset = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
    return preset?.ratio || nativeVideoRatio;
  }, [aspectRatio, nativeVideoRatio]);

  const needsCrop = useMemo(() => {
    if (aspectRatio === "auto") return false;
    return Math.abs(targetAspectRatio - nativeVideoRatio) > 0.05;
  }, [aspectRatio, targetAspectRatio, nativeVideoRatio]);

  // ═════════════════════════════════════════════════════
  // PLAYBACK TIMER
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    if (timeline.playing) {
      playIntervalRef.current = setInterval(() => {
        dispatch({ type: "SET_TIME", time: timeline.currentTime + FRAME_DURATION });
      }, FRAME_DURATION * 1000);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [timeline.playing, timeline.currentTime]);

  useEffect(() => {
    if (timeline.playing && timeline.currentTime >= timeline.duration) {
      dispatch({ type: "SET_PLAYING", playing: false });
      dispatch({ type: "SET_TIME", time: 0 });
    }
  }, [timeline.currentTime, timeline.duration, timeline.playing]);

  // ── Sync video element with timeline ───────────────
  useEffect(() => {
    if (editorVideoRef.current && currentStep === 3) {
      const video = editorVideoRef.current;
      if (Math.abs(video.currentTime - timeline.currentTime) > 0.1) {
        video.currentTime = timeline.currentTime;
      }
      if (timeline.playing && video.paused) video.play();
      if (!timeline.playing && !video.paused) video.pause();
    }
  }, [timeline.currentTime, timeline.playing, currentStep]);

  // ── Sync playback speed with video element ────────
  useEffect(() => {
    if (editorVideoRef.current) {
      editorVideoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // ── Noise Removal Audio Chain ─────────────────────
  useEffect(() => {
    const video = editorVideoRef.current;
    if (!video || currentStep !== 3) return;

    if (noiseRemovalSettings.enabled) {
      // Create AudioContext and chain if not exist
      if (!audioContextRef.current) {
        try {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;

          const source = ctx.createMediaElementSource(video);
          mediaSourceRef.current = source;

          const highpass = ctx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = noiseRemovalSettings.highpassFreq;

          const lowpass = ctx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = noiseRemovalSettings.lowpassFreq;

          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = noiseRemovalSettings.gateThreshold;
          compressor.knee.value = 40;
          compressor.ratio.value = 12;
          compressor.attack.value = 0;
          compressor.release.value = 0.25;

          const voiceBoost = ctx.createBiquadFilter();
          voiceBoost.type = "peaking";
          voiceBoost.frequency.value = 2500;
          voiceBoost.gain.value = noiseRemovalSettings.voiceBoost;

          source.connect(highpass);
          highpass.connect(lowpass);
          lowpass.connect(compressor);
          compressor.connect(voiceBoost);
          voiceBoost.connect(ctx.destination);

          noiseChainRef.current = { highpass, lowpass, compressor, voiceBoost };
        } catch (err) {
          console.error("[noise-removal] Failed to create audio chain:", err);
        }
      } else if (noiseChainRef.current) {
        // Update existing chain params
        const chain = noiseChainRef.current;
        chain.highpass.frequency.value = noiseRemovalSettings.highpassFreq;
        chain.lowpass.frequency.value = noiseRemovalSettings.lowpassFreq;
        chain.compressor.threshold.value = noiseRemovalSettings.gateThreshold;
        chain.voiceBoost.gain.value = noiseRemovalSettings.voiceBoost;
      }
    } else {
      // Disabled — bypass: reconnect source directly to destination
      if (audioContextRef.current && mediaSourceRef.current && noiseChainRef.current) {
        try {
          const chain = noiseChainRef.current;
          chain.voiceBoost.disconnect();
          chain.compressor.disconnect();
          chain.lowpass.disconnect();
          chain.highpass.disconnect();
          mediaSourceRef.current.disconnect();
          mediaSourceRef.current.connect(audioContextRef.current.destination);
          noiseChainRef.current = null;
        } catch (err) {
          console.error("[noise-removal] Disconnect error:", err);
        }
      }
    }
  }, [noiseRemovalSettings, currentStep]);

  // ═════════════════════════════════════════════════════
  // SNAP HELPER
  // ═════════════════════════════════════════════════════

  const snapTime = useCallback(
    (time: number, excludeClipId?: string): number => {
      if (!snapEnabled) return time;
      const edges: number[] = [0];
      timeline.clips.forEach((c) => {
        if (c.id === excludeClipId) return;
        edges.push(c.startTime, c.startTime + c.duration);
      });
      edges.push(timeline.currentTime);
      const threshold = SNAP_THRESHOLD_PX / pixelsPerSecond;
      let closest = time;
      let minDist = threshold;
      for (const edge of edges) {
        const d = Math.abs(time - edge);
        if (d < minDist) {
          minDist = d;
          closest = edge;
        }
      }
      return closest;
    },
    [snapEnabled, timeline.clips, timeline.currentTime, pixelsPerSecond]
  );

  // ═════════════════════════════════════════════════════
  // CLIP DRAG/RESIZE HANDLERS
  // ═════════════════════════════════════════════════════

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, edge: "left" | "right" | "body") => {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedClipIds((prev) => {
          const next = new Set(prev);
          next.has(clip.id) ? next.delete(clip.id) : next.add(clip.id);
          return next;
        });
      } else if (!selectedClipIds.has(clip.id)) {
        setSelectedClipIds(new Set([clip.id]));
      }
      dragRef.current = {
        clipId: clip.id,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        origStart: clip.startTime,
        origDuration: clip.duration,
        origTrackIndex: clip.trackIndex,
      };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dt = dx / pixelsPerSecond;
        if (dragRef.current.edge === "body") {
          const rawTime = dragRef.current.origStart + dt;
          const snapped = snapTime(rawTime, dragRef.current.clipId);
          const dy = ev.clientY - dragRef.current.startY;
          const trackDelta = Math.round(dy / 60);
          const newTrackIdx = Math.max(0, Math.min(TRACKS.length - 1, dragRef.current.origTrackIndex + trackDelta));
          dispatch({ type: "MOVE_CLIP", clipId: dragRef.current.clipId, startTime: Math.max(0, snapped), trackIndex: newTrackIdx });
        } else if (dragRef.current.edge === "left") {
          const rawStart = dragRef.current.origStart + dt;
          const snapped = snapTime(rawStart, dragRef.current.clipId);
          const maxStart = dragRef.current.origStart + dragRef.current.origDuration - 0.1;
          const newStart = Math.max(0, Math.min(snapped, maxStart));
          const newDur = dragRef.current.origDuration - (newStart - dragRef.current.origStart);
          dispatch({ type: "TRIM_CLIP", clipId: dragRef.current.clipId, startTime: newStart, duration: newDur });
        } else {
          const rawDur = dragRef.current.origDuration + dt;
          const snapped = snapTime(dragRef.current.origStart + rawDur, dragRef.current.clipId);
          const newDur = Math.max(0.1, snapped - dragRef.current.origStart);
          dispatch({ type: "TRIM_CLIP", clipId: dragRef.current.clipId, startTime: dragRef.current.origStart, duration: newDur });
        }
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [selectedClipIds, pixelsPerSecond, snapTime]
  );

  // ═════════════════════════════════════════════════════
  // SPLIT HANDLER
  // ═════════════════════════════════════════════════════

  const handleSplit = useCallback(() => {
    // If clips selected, split them
    if (selectedClipIds.size > 0) {
      selectedClipIds.forEach((id) => {
        dispatch({ type: "SPLIT_CLIP", clipId: id, splitAt: timeline.currentTime });
      });
      return;
    }
    // Otherwise find active video clip at playhead
    const activeClip = timeline.clips.find(
      (c) =>
        c.trackType === "video" &&
        timeline.currentTime >= c.startTime &&
        timeline.currentTime < c.startTime + c.duration
    );
    if (activeClip) {
      dispatch({ type: "SPLIT_CLIP", clipId: activeClip.id, splitAt: timeline.currentTime });
    }
  }, [selectedClipIds, timeline.clips, timeline.currentTime]);

  // ═════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS (editor only)
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    if (currentStep !== 3) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (true) {
        case e.code === "Space": {
          e.preventDefault();
          dispatch({ type: "SET_PLAYING", playing: !timeline.playing });
          break;
        }
        case e.code === "ArrowLeft": {
          e.preventDefault();
          dispatch({ type: "SET_TIME", time: timeline.currentTime - FRAME_DURATION });
          break;
        }
        case e.code === "ArrowRight": {
          e.preventDefault();
          dispatch({ type: "SET_TIME", time: timeline.currentTime + FRAME_DURATION });
          break;
        }
        case (e.code === "Delete" || e.code === "Backspace") && selectedClipIds.size > 0: {
          e.preventDefault();
          selectedClipIds.forEach((id) => dispatch({ type: "REMOVE_CLIP", clipId: id }));
          setSelectedClipIds(new Set());
          break;
        }
        case e.code === "KeyZ" && (e.ctrlKey || e.metaKey) && e.shiftKey: {
          e.preventDefault();
          dispatch({ type: "REDO" });
          break;
        }
        case e.code === "KeyZ" && (e.ctrlKey || e.metaKey): {
          e.preventDefault();
          dispatch({ type: "UNDO" });
          break;
        }
        case e.code === "KeyS" && !e.ctrlKey && !e.metaKey: {
          e.preventDefault();
          handleSplit();
          break;
        }
        // J/K/L — professional playback controls
        case e.code === "KeyJ": {
          e.preventDefault();
          setPlaybackSpeed((prev) => Math.max(0.25, prev - 0.25));
          if (!timeline.playing) dispatch({ type: "SET_PLAYING", playing: true });
          break;
        }
        case e.code === "KeyK": {
          e.preventDefault();
          dispatch({ type: "SET_PLAYING", playing: false });
          setPlaybackSpeed(1);
          break;
        }
        case e.code === "KeyL": {
          e.preventDefault();
          setPlaybackSpeed((prev) => Math.min(3, prev + 0.25));
          if (!timeline.playing) dispatch({ type: "SET_PLAYING", playing: true });
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentStep, timeline.playing, timeline.currentTime, selectedClipIds, handleSplit]);

  // ── Zoom with scroll ──
  useEffect(() => {
    const el = timelineBodyRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        dispatch({ type: "SET_ZOOM", zoom: timeline.zoom + delta });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [timeline.zoom]);

  // ═════════════════════════════════════════════════════
  // RESIZE HANDLERS
  // ═════════════════════════════════════════════════════

  const startResizeH = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingH.current = true;
      const startX = e.clientX;
      const startWidth = previewWidth;
      const onMove = (ev: MouseEvent) => {
        if (!isResizingH.current) return;
        const containerW = window.innerWidth;
        const delta = ((ev.clientX - startX) / containerW) * 100;
        setPreviewWidth(Math.max(30, Math.min(75, startWidth + delta)));
      };
      const onUp = () => {
        isResizingH.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [previewWidth]
  );

  const startResizeV = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingV.current = true;
      const startY = e.clientY;
      const startH = timelineHeight;
      const onMove = (ev: MouseEvent) => {
        if (!isResizingV.current) return;
        const delta = startY - ev.clientY;
        setTimelineHeight(Math.max(180, Math.min(500, startH + delta)));
      };
      const onUp = () => {
        isResizingV.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [timelineHeight]
  );


  // ═════════════════════════════════════════════════════
  // CROP/ZOOM DRAG HANDLERS
  // ═════════════════════════════════════════════════════

  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!needsCrop) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingCrop(true);
      cropDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: cropPosition.x,
        origY: cropPosition.y,
      };
      const onMove = (ev: MouseEvent) => {
        if (!cropDragRef.current) return;
        const dx = (ev.clientX - cropDragRef.current.startX) / cropPosition.scale;
        const dy = (ev.clientY - cropDragRef.current.startY) / cropPosition.scale;
        setCropPosition((prev) => ({
          ...prev,
          x: cropDragRef.current!.origX + dx,
          y: cropDragRef.current!.origY + dy,
        }));
      };
      const onUp = () => {
        setIsDraggingCrop(false);
        cropDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [needsCrop, cropPosition.x, cropPosition.y, cropPosition.scale]
  );

  const cropContainerRef = useRef<HTMLDivElement>(null);

  // Use native event listener for crop wheel to allow preventDefault (passive: false)
  useEffect(() => {
    const el = cropContainerRef.current;
    if (!el || !needsCrop) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.002;
      setCropPosition((prev) => ({
        ...prev,
        scale: Math.max(1, Math.min(3, prev.scale + delta)),
      }));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [needsCrop]);

  // Reset crop when aspect ratio changes
  useEffect(() => {
    setCropPosition({ x: 0, y: 0, scale: 1 });
  }, [aspectRatio]);

  // ═════════════════════════════════════════════════════
  // STEP 1: FILE UPLOAD HANDLER
  // ═════════════════════════════════════════════════════

  const handleFileSelect = useCallback((file: File) => {
    // Warn if file is too large for Whisper (25MB)
    if (file.size > 25 * 1024 * 1024) {
      const sizeMB = (file.size / 1048576).toFixed(0);
      const proceed = window.confirm(
        `Video yra ${sizeMB}MB. Whisper AI transkripcijai reikia ≤25MB.\n\n` +
        `Platforma bandys automatiškai sumažinti audio.\n` +
        `Jei nepavyks — sumažinkite video prieš įkeliant.\n\n` +
        `Tęsti?`
      );
      if (!proceed) return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setUploadedFile({
        file,
        url,
        name: file.name,
        size: file.size,
        duration: video.duration,
      });
      setProjectName(file.name.replace(/\.[^.]+$/, ""));
    };
    video.src = url;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // ═════════════════════════════════════════════════════
  // STEP 2 → PROCESSING → STEP 3 PIPELINE
  // ═════════════════════════════════════════════════════

  const buildProcessingSteps = useCallback(
    (mode: EditingMode, detail: AIDetailLevel): ProcessingStep[] => {
      const steps: ProcessingStep[] = [];
      steps.push({ id: "transcribe", label: "⏳ Transkribuojama...", status: "pending" });

      if (mode === "reference-clone") {
        steps.push({ id: "ref-analyze", label: "⏳ Analizuojamas reference stilius...", status: "pending" });
      }

      steps.push({ id: "analyze", label: "⏳ Analizuojama...", status: "pending" });
      steps.push({ id: "subtitles", label: "⏳ Generuojami subtitrai...", status: "pending" });

      if (mode !== "subtitles-only" && detail !== "quick") {
        steps.push({ id: "broll", label: "⏳ Generuojamas B-roll...", status: "pending" });
        steps.push({ id: "music", label: "⏳ Parenkama muzika...", status: "pending" });
      }

      if (mode !== "subtitles-only" && detail === "premium") {
        steps.push({ id: "effects", label: "⏳ Pritaikomi efektai...", status: "pending" });
      }

      steps.push({ id: "done", label: "✅ Paruošta!", status: "pending" });
      return steps;
    },
    []
  );

  const advanceStep = useCallback(
    (steps: ProcessingStep[], currentId: string): ProcessingStep[] => {
      let foundCurrent = false;
      return steps.map((s) => {
        if (s.id === currentId) {
          foundCurrent = true;
          return { ...s, status: "done" as const };
        }
        if (foundCurrent && s.status === "pending") {
          foundCurrent = false;
          return { ...s, status: "active" as const };
        }
        return s;
      });
    },
    []
  );

  const startProcessing = useCallback(
    async (mode: EditingMode, detail: AIDetailLevel) => {
      if (!uploadedFile) return;

      setIsProcessing(true);
      setProcessingErrors([]);
      const steps = buildProcessingSteps(mode, detail);
      // Activate first step
      steps[0].status = "active";
      setProcessingSteps([...steps]);

      let currentSteps = [...steps];
      const errors: string[] = [];

      const advance = (stepId: string) => {
        currentSteps = advanceStep(currentSteps, stepId);
        setProcessingSteps([...currentSteps]);
      };

      const markError = (stepId: string, errorMsg: string) => {
        currentSteps = currentSteps.map((s) => {
          if (s.id === stepId) return { ...s, status: "error" as const, label: `❌ ${errorMsg}` };
          return s;
        });
        // Activate next pending step
        let activated = false;
        currentSteps = currentSteps.map((s) => {
          if (!activated && s.status === "pending") {
            activated = true;
            return { ...s, status: "active" as const };
          }
          return s;
        });
        setProcessingSteps([...currentSteps]);
        errors.push(errorMsg);
        setProcessingErrors([...errors]);
      };

      // We'll collect data across steps
      let transcriptSegments: TranscriptSegment[] = [];
      let analysisBrollSuggestions: BrollSuggestion[] = [];
      let analysisZoomMoments: { timestamp: number; word: string; type: string }[] = [];
      let analysisSuggestedMusic: { genre: string; mood: string } | null = null;
      let collectedBrollClips: { suggestion: BrollSuggestion; clips: BrollClip[] }[] = [];
      let musicTrack: MusicTrack | null = null;

      try {
        // ═══ 1. TRANSCRIBE (direct to OpenAI from browser — no Vercel body limit) ═══
        try {
          // Get API key from lightweight server endpoint
          const keyRes = await fetch("/api/whisper-key");
          if (!keyRes.ok) throw new Error("Nepavyko gauti API rakto");
          const { k: apiKey } = await keyRes.json();
          if (!apiKey) throw new Error("API raktas nerastas");

          // Prepare file — use FFmpeg WASM to extract audio if >25MB
          let fileForWhisper: File | Blob = uploadedFile.file;
          
          if (fileForWhisper.size > 25 * 1024 * 1024) {
            console.log(`[transcribe] File is ${(fileForWhisper.size/1048576).toFixed(1)}MB — extracting audio with FFmpeg...`);
            
            try {
              const audioFile = await extractAudioForWhisper(
                fileForWhisper as File,
                (msg, pct) => {
                  currentSteps = currentSteps.map((s) =>
                    s.id === "transcribe" && s.status === "active"
                      ? { ...s, label: `⏳ ${msg}` }
                      : s
                  );
                  setProcessingSteps([...currentSteps]);
                }
              );
              
              if (audioFile) {
                fileForWhisper = audioFile;
                console.log(`[transcribe] Audio extracted: ${(audioFile.size/1024).toFixed(0)}KB MP3`);
              } else {
                throw new Error("FFmpeg audio extraction nepavyko");
              }
            } catch (extractErr) {
              const msg = extractErr instanceof Error ? extractErr.message : String(extractErr);
              throw new Error(`Nepavyko sumažinti video (${(uploadedFile.file.size/1048576).toFixed(0)}MB): ${msg}`);
            }
            
            // Restore label
            currentSteps = currentSteps.map((s) =>
              s.id === "transcribe" && s.status === "active"
                ? { ...s, label: "⏳ Transkribuojama..." }
                : s
            );
            setProcessingSteps([...currentSteps]);
          }

          console.log(`[transcribe] Sending ${(fileForWhisper.size/1048576).toFixed(1)}MB to OpenAI`);

          // Send video directly to OpenAI Whisper API from the browser
          const fd = new FormData();
          fd.append("file", fileForWhisper, fileForWhisper.name);
          fd.append("model", "whisper-1");
          fd.append("response_format", "verbose_json");
          fd.append("timestamp_granularities[]", "word");
          fd.append("timestamp_granularities[]", "segment");
          fd.append("language", "lt");

          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: fd,
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("[transcribe] Whisper error:", res.status, errText);
            throw new Error(`Whisper klaida (${res.status}): ${errText.substring(0, 100)}`);
          }

          const data = await res.json();
          console.log("[transcribe] Response keys:", Object.keys(data));
          console.log("[transcribe] Segments:", Array.isArray(data.segments) ? data.segments.length : "none");

          // Parse segments
          const segs = Array.isArray(data.segments) ? data.segments : [];
          const words = Array.isArray(data.words) ? data.words : [];

          const allWords = words.map((w: Record<string, unknown>) => ({
            word: String(w.word || ""),
            start: Number(w.start || 0),
            end: Number(w.end || 0),
          }));

          const parsedSegments: TranscriptSegment[] = segs.map(
            (seg: Record<string, unknown>, idx: number) => {
              const segStart = Number(seg.start || 0);
              const segEnd = Number(seg.end || 0);
              const segWords = allWords.filter(
                (w: { start: number; end: number }) => w.start >= segStart && w.end <= segEnd + 0.05
              );
              return {
                id: `seg-${idx}`,
                text: String(seg.text || "").trim(),
                start: segStart,
                end: segEnd,
                words: segWords,
              };
            }
          );

          // Fallback: one segment from full text
          if (parsedSegments.length === 0 && data.text) {
            parsedSegments.push({
              id: "seg-0",
              text: String(data.text).trim(),
              start: 0,
              end: Number(data.duration || 0),
              words: allWords,
            });
          }

          if (parsedSegments.length > 0) {
            transcriptSegments = parsedSegments;
            setTranscript(parsedSegments);
          } else {
            throw new Error("Whisper negrąžino segmentų");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          markError("transcribe", `Transkripcija nepavyko: ${msg}`);
          console.error("Transcribe failed:", err);
        }
        if (!currentSteps.find(s => s.id === "transcribe" && s.status === "error")) {
          advance("transcribe");
        }
        await new Promise((r) => setTimeout(r, 300));

        // ═══ 2. REFERENCE ANALYZE (if clone mode) ═══
        if (mode === "reference-clone") {
          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: "Analyze reference video style",
                language: "lt",
              }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({ error: "Unknown" }));
              throw new Error(errData.error || `HTTP ${res.status}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            markError("ref-analyze", `Reference analizė nepavyko: ${msg}`);
            console.error("Reference analysis failed:", err);
          }
          if (!currentSteps.find(s => s.id === "ref-analyze" && s.status === "error")) {
            advance("ref-analyze");
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        // ═══ 3. ANALYZE ═══
        if (transcriptSegments.length > 0) {
          const fullTranscriptText = transcriptSegments.map((s) => s.text).join(" ");
          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: fullTranscriptText,
                language: "lt",
              }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({ error: "Unknown" }));
              throw new Error(errData.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.brollSuggestions && Array.isArray(data.brollSuggestions)) {
              // Map API response to BrollSuggestion type with required fields
              analysisBrollSuggestions = data.brollSuggestions.map((s: Record<string, unknown>, i: number) => ({
                id: `broll-sug-${i}`,
                timestamp: Number(s.timestamp) || 0,
                duration: Number(s.duration) || 3,
                keyword: String(s.keyword || ""),
                cinematicPrompt: String(s.cinematicPrompt || ""),
                pexelsQuery: String(s.pexelsQuery || ""),
                type: "stock" as const,
                shotType: "wide" as const,
                mood: "calm" as const,
              }));
              setBrollSuggestions(analysisBrollSuggestions);
            }
            if (data.zoomMoments && Array.isArray(data.zoomMoments)) {
              analysisZoomMoments = data.zoomMoments;
              setZoomMoments(data.zoomMoments);
            }
            if (data.suggestedMusic) {
              analysisSuggestedMusic = data.suggestedMusic;
              setSuggestedMusic(data.suggestedMusic);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            markError("analyze", `Analizė nepavyko: ${msg}`);
            console.error("Analyze failed:", err);
          }
        } else {
          markError("analyze", "Analizė praleista — nėra transkripcijos");
        }
        if (!currentSteps.find(s => s.id === "analyze" && s.status === "error")) {
          advance("analyze");
        }
        await new Promise((r) => setTimeout(r, 300));

        // ═══ 4. SUBTITLES (from transcript) ═══
        if (transcriptSegments.length === 0) {
          markError("subtitles", "Subtitrai praleisti — nėra transkripcijos");
        }
        if (!currentSteps.find(s => s.id === "subtitles" && s.status === "error")) {
          advance("subtitles");
        }
        await new Promise((r) => setTimeout(r, 200));

        // ═══ 5. B-ROLL (if applicable) ═══
        if (mode !== "subtitles-only" && detail !== "quick") {
          const suggestionsToProcess = analysisBrollSuggestions.length > 0 ? analysisBrollSuggestions : [];
          
          if (suggestionsToProcess.length === 0) {
            markError("broll", "B-roll praleistas — nėra pasiūlymų iš analizės");
          } else {
            try {
              if (detail === "premium") {
                // Use AI-generated B-roll via /api/broll-generate
                for (const suggestion of suggestionsToProcess) {
                  try {
                    const res = await fetch("/api/broll-generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        prompt: suggestion.cinematicPrompt || suggestion.keyword,
                        model: brollModel,
                        style: "cinematic",
                        aspectRatio: "9:16",
                        duration: Math.min(Math.max(suggestion.duration || 5, 5), 10),
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.clip) {
                        collectedBrollClips.push({
                          suggestion,
                          clips: [{
                            id: data.clip.id || `gen-${Date.now()}`,
                            src: data.clip.src || data.videoUrl,
                            thumbnail: data.clip.thumbnail || data.thumbnail || "",
                            duration: data.clip.duration || suggestion.duration || 5,
                            source: (data.clip.source || "kling") as "pexels" | "kling" | "upload",
                            overlayMode: "fullscreen" as const,
                          }],
                        });
                      }
                    }
                  } catch (genErr) {
                    console.error(`B-roll generate failed for "${suggestion.keyword}":`, genErr);
                  }
                }
              } else {
                // Use Pexels stock search via /api/broll
                for (const suggestion of suggestionsToProcess) {
                  try {
                    const query = suggestion.pexelsQuery || suggestion.keyword;
                    const res = await fetch("/api/broll", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        query,
                        perPage: 3,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.clips && data.clips.length > 0) {
                        collectedBrollClips.push({
                          suggestion,
                          clips: data.clips,
                        });
                      }
                    }
                  } catch (searchErr) {
                    console.error(`B-roll search failed for "${suggestion.keyword}":`, searchErr);
                  }
                }
              }
              setFetchedBrollClips(collectedBrollClips);
              if (collectedBrollClips.length === 0) {
                markError("broll", "B-roll: nerasta tinkamų klipų");
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              markError("broll", `B-roll nepavyko: ${msg}`);
              console.error("B-roll failed:", err);
            }
          }
          if (!currentSteps.find(s => s.id === "broll" && s.status === "error")) {
            advance("broll");
          }
          await new Promise((r) => setTimeout(r, 300));

          // ═══ 6. MUSIC ═══
          try {
            const fullText = transcriptSegments.map((s) => s.text).join(" ");
            let genre = analysisSuggestedMusic?.genre || "ambient";
            let mood = analysisSuggestedMusic?.mood || "chill";

            // a) Ask AI to suggest genre/mood from transcript
            if (fullText.length > 10) {
              try {
                const suggestRes = await fetch("/api/music/suggest", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transcript: fullText }),
                });
                if (suggestRes.ok) {
                  const suggestData = await suggestRes.json();
                  if (suggestData.genre) genre = suggestData.genre;
                  if (suggestData.mood) mood = suggestData.mood;
                  // suggest endpoint also returns tracks directly
                  if (suggestData.tracks && suggestData.tracks.length > 0) {
                    musicTrack = suggestData.tracks[0];
                    setFetchedMusicTrack(suggestData.tracks[0]);
                  }
                }
              } catch {
                console.error("Music suggest failed, falling back to direct search");
              }
            }

            // b) If no track from suggest, fetch via GET /api/music
            if (!musicTrack) {
              const musicRes = await fetch(`/api/music?genre=${encodeURIComponent(genre)}&mood=${encodeURIComponent(mood)}`);
              if (musicRes.ok) {
                const musicData = await musicRes.json();
                if (musicData.tracks && musicData.tracks.length > 0) {
                  musicTrack = musicData.tracks[0];
                  setFetchedMusicTrack(musicData.tracks[0]);
                }
              }
            }

            if (!musicTrack) {
              markError("music", "Muzika: nerasta tinkamų takelių");
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            markError("music", `Muzikos parinkimas nepavyko: ${msg}`);
            console.error("Music selection failed:", err);
          }
          if (!currentSteps.find(s => s.id === "music" && s.status === "error")) {
            advance("music");
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        // ═══ 7. EFFECTS (premium) ═══
        if (mode !== "subtitles-only" && detail === "premium") {
          // Effects are built from zoomMoments in buildTimeline
          advance("effects");
          await new Promise((r) => setTimeout(r, 300));
        }

        // ═══ DONE ═══
        advance("done");
        await new Promise((r) => setTimeout(r, 400));

        // Build timeline with REAL collected data
        buildTimeline(mode, detail, transcriptSegments, collectedBrollClips, musicTrack, analysisZoomMoments);

        // Transition to editor
        setIsProcessing(false);
        setCurrentStep(3);
      } catch (err) {
        console.error("Processing pipeline error:", err);
        setIsProcessing(false);
      }
    },
    [uploadedFile, brollModel, referenceVideoUrl, buildProcessingSteps, advanceStep]
  );

  // ═════════════════════════════════════════════════════
  // BUILD TIMELINE (pre-loaded content for editor)
  // ═════════════════════════════════════════════════════

  const buildTimeline = useCallback(
    (
      mode: EditingMode,
      detail: AIDetailLevel,
      transcriptSegs?: TranscriptSegment[],
      brollClipsData?: { suggestion: BrollSuggestion; clips: BrollClip[] }[],
      music?: MusicTrack | null,
      zoomData?: { timestamp: number; word: string; type: string }[],
    ) => {
      if (!uploadedFile) return;

      const dur = uploadedFile.duration || 30;
      const segs = transcriptSegs || transcript;

      // ═══ VIDEO CLIP ═══
      dispatch({
        type: "ADD_CLIP",
        clip: {
          id: uid("video"),
          trackType: "video",
          trackIndex: 0,
          startTime: 0,
          duration: dur,
          label: uploadedFile.name,
          src: uploadedFile.url,
        },
      });

      // ═══ ORIGINAL AUDIO CLIP ═══
      dispatch({
        type: "ADD_CLIP",
        clip: {
          id: uid("audio"),
          trackType: "audio",
          trackIndex: 1,
          startTime: 0,
          duration: dur,
          label: "Original Audio",
          src: uploadedFile.url,
        },
      });

      // ═══ SUBTITLE CLIPS FROM REAL TRANSCRIPT ═══
      // Split into short phrases (2-4 words each) for CapCut-style subtitles
      if (segs.length > 0) {
        const WORDS_PER_CLIP = 3; // 3 words per subtitle clip
        
        segs.forEach((seg) => {
          if (seg.words && seg.words.length > 0) {
            // Use word-level timestamps for precise clips
            for (let i = 0; i < seg.words.length; i += WORDS_PER_CLIP) {
              const chunk = seg.words.slice(i, i + WORDS_PER_CLIP);
              const text = chunk.map((w) => w.word).join(" ").trim();
              if (!text) continue;
              
              const clipStart = chunk[0].start;
              const clipEnd = chunk[chunk.length - 1].end;
              const clipDuration = Math.max(0.2, clipEnd - clipStart);
              
              dispatch({
                type: "ADD_CLIP",
                clip: {
                  id: uid("sub"),
                  trackType: "subtitle",
                  trackIndex: 2,
                  startTime: clipStart,
                  duration: clipDuration,
                  label: text,
                  words: chunk.map((w) => ({ word: w.word, start: w.start, end: w.end })),
                  style: captionStyle || undefined,
                },
              });
            }
          } else {
            // Fallback: split text by words manually
            const words = seg.text.split(/\s+/).filter(Boolean);
            const segDuration = seg.end - seg.start;
            const wordDuration = segDuration / Math.max(1, words.length);
            
            for (let i = 0; i < words.length; i += WORDS_PER_CLIP) {
              const chunk = words.slice(i, i + WORDS_PER_CLIP);
              const text = chunk.join(" ");
              const clipStart = seg.start + i * wordDuration;
              const clipDuration = Math.max(0.2, chunk.length * wordDuration);
              
              dispatch({
                type: "ADD_CLIP",
                clip: {
                  id: uid("sub"),
                  trackType: "subtitle",
                  trackIndex: 2,
                  startTime: clipStart,
                  duration: clipDuration,
                  label: text,
                  words: chunk.map((w, wi) => ({
                    word: w,
                    start: clipStart + wi * wordDuration,
                    end: clipStart + (wi + 1) * wordDuration,
                  })),
                  style: captionStyle || undefined,
                },
              });
            }
          }
        });
      }

      // ═══ B-ROLL CLIPS FROM REAL API RESPONSES ═══
      if (mode !== "subtitles-only" && detail !== "quick") {
        const brollData = brollClipsData || fetchedBrollClips;
        brollData.forEach(({ suggestion, clips }) => {
          if (clips.length > 0) {
            const bestClip = clips[0]; // Use the first/best clip
            dispatch({
              type: "ADD_CLIP",
              clip: {
                id: uid("broll"),
                trackType: "broll",
                trackIndex: 3,
                startTime: suggestion.timestamp,
                duration: suggestion.duration || bestClip.duration || 3,
                label: `B-Roll: ${suggestion.keyword}`,
                src: bestClip.src,
              },
            });
          }
        });

        // ═══ MUSIC CLIP FROM REAL API RESPONSE ═══
        const track = music || fetchedMusicTrack;
        if (track) {
          dispatch({
            type: "ADD_CLIP",
            clip: {
              id: uid("music"),
              trackType: "audio",
              trackIndex: 1,
              startTime: 0,
              duration: Math.min(track.duration || dur, dur),
              label: `♫ ${track.title} — ${track.artist}`,
              src: track.previewUrl || track.downloadUrl,
            },
          });
        }
      }

      // ═══ EFFECTS FROM ZOOM MOMENTS (premium) ═══
      if (mode !== "subtitles-only" && detail === "premium") {
        const zooms = zoomData || zoomMoments;
        if (zooms.length > 0) {
          zooms.forEach((zm) => {
            const effectTypeMap: Record<string, EffectType> = {
              "quick-emphasis": "zoom-in",
              "slow-zoom": "zoom-in",
              "zoom-out": "zoom-out",
              "zoom-pulse": "zoom-pulse",
            };
            const effectType = effectTypeMap[zm.type] || "zoom-in";
            const effectDuration = zm.type === "slow-zoom" ? 2 : zm.type === "zoom-pulse" ? 1.5 : 0.8;
            dispatch({
              type: "ADD_CLIP",
              clip: {
                id: uid("fx"),
                trackType: "effect",
                trackIndex: 4,
                startTime: zm.timestamp,
                duration: effectDuration,
                label: `${zm.type}: "${zm.word}"`,
                effectType,
              },
            });
          });
        } else {
          // Fallback: default hook + outro effects
          dispatch({
            type: "ADD_CLIP",
            clip: {
              id: uid("fx"),
              trackType: "effect",
              trackIndex: 4,
              startTime: 0,
              duration: 1.5,
              label: "Zoom In (Hook)",
              effectType: "zoom-in",
            },
          });
          if (dur > 5) {
            dispatch({
              type: "ADD_CLIP",
              clip: {
                id: uid("fx"),
                trackType: "effect",
                trackIndex: 4,
                startTime: dur - 3,
                duration: 3,
                label: "Ken Burns (Outro)",
                effectType: "ken-burns",
              },
            });
          }
        }
      }
    },
    [uploadedFile, transcript, captionStyle, fetchedBrollClips, fetchedMusicTrack, zoomMoments]
  );

  // ═════════════════════════════════════════════════════
  // INTEGRATION CALLBACKS
  // ═════════════════════════════════════════════════════

  const handleStyleSelect = useCallback(
    (style: CaptionStyle) => {
      setCaptionStyle(style);
      if (currentStep === 3) {
        // Remove old subtitle clips and recreate with word-level splitting
        const WORDS_PER_CLIP = 3;
        const oldSubIds = timeline.clips.filter((c) => c.trackType === "subtitle").map((c) => c.id);
        oldSubIds.forEach((id) => dispatch({ type: "REMOVE_CLIP", clipId: id }));
        transcript.forEach((seg) => {
          if (seg.words && seg.words.length > 0) {
            for (let i = 0; i < seg.words.length; i += WORDS_PER_CLIP) {
              const chunk = seg.words.slice(i, i + WORDS_PER_CLIP);
              const text = chunk.map((w) => w.word).join(" ").trim();
              if (!text) continue;
              dispatch({
                type: "ADD_CLIP",
                clip: {
                  id: uid("sub"),
                  trackType: "subtitle",
                  trackIndex: 2,
                  startTime: chunk[0].start,
                  duration: Math.max(0.2, chunk[chunk.length - 1].end - chunk[0].start),
                  label: text,
                  words: chunk.map((w) => ({ word: w.word, start: w.start, end: w.end })),
                  style,
                },
              });
            }
          } else {
            const words = seg.text.split(/\s+/).filter(Boolean);
            const segDur = seg.end - seg.start;
            const wordDur = segDur / Math.max(1, words.length);
            for (let i = 0; i < words.length; i += WORDS_PER_CLIP) {
              const chunk = words.slice(i, i + WORDS_PER_CLIP);
              const chunkStart = seg.start + i * wordDur;
              dispatch({
                type: "ADD_CLIP",
                clip: {
                  id: uid("sub"),
                  trackType: "subtitle",
                  trackIndex: 2,
                  startTime: chunkStart,
                  duration: Math.max(0.2, chunk.length * wordDur),
                  label: chunk.join(" "),
                  words: chunk.map((w, wi) => ({
                    word: w,
                    start: chunkStart + wi * wordDur,
                    end: chunkStart + (wi + 1) * wordDur,
                  })),
                  style,
                },
              });
            }
          }
        });
      }
    },
    [currentStep, transcript, timeline.clips]
  );

  const handleBrollAdd = useCallback((clip: BrollClip, timestamp: number) => {
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id: uid("broll"),
        trackType: "broll",
        trackIndex: 3,
        startTime: timestamp,
        duration: clip.duration || 3,
        label: `B-Roll (${clip.source})`,
        src: clip.src,
      },
    });
  }, []);

  const handleAddEffect = useCallback((keyframe: EffectKeyframe) => {
    // Prettier label from effect type
    const effectLabel = keyframe.type
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id: uid("fx"),
        trackType: "effect",
        trackIndex: 4,
        startTime: keyframe.time,
        duration: keyframe.duration,
        label: `✨ ${effectLabel}`,
        effectType: keyframe.type,
        effectParams: keyframe.params,
      },
    });
  }, []);

  // ── Effects Engine integration callbacks ────────────
  const handleFilterChange = useCallback((filter: { cssFilter: string; overlayCSS?: React.CSSProperties; filterId: string } | null) => {
    if (!filter) {
      setActiveFilterCSS("");
      setActiveFilterOverlay(null);
    } else {
      setActiveFilterCSS(filter.cssFilter !== "none" ? filter.cssFilter : "");
      setActiveFilterOverlay(filter.overlayCSS || null);
    }
  }, []);

  const handleZoomChange = useCallback((zoom: { cssTransform: string; cssTransition: string; zoomId: string } | null) => {
    if (!zoom) {
      setActiveZoomCSS("");
      setActiveZoomTransition("");
    } else {
      setActiveZoomCSS(zoom.cssTransform);
      setActiveZoomTransition(zoom.cssTransition);
    }
  }, []);

  const handleAddMusicTrack = useCallback((track: MusicTrack) => {
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id: uid("music"),
        trackType: "audio",
        trackIndex: 1,
        startTime: timeline.currentTime,
        duration: track.duration || 30,
        label: `♫ ${track.title}`,
        src: track.previewUrl || track.downloadUrl,
      },
    });
  }, [timeline.currentTime]);

  // ── Cleanup: Silence Removal → timeline cut markers ──
  const handleCleanupSilenceRemoval = useCallback((segments: SilenceSegment[], action: string) => {
    if (action === "cut" && segments.length > 0) {
      // Add cut marker clips to the effects track for each segment
      segments.forEach((seg) => {
        dispatch({
          type: "ADD_CLIP",
          clip: {
            id: uid("cut"),
            trackType: "effect",
            trackIndex: 4,
            startTime: seg.start,
            duration: seg.duration,
            label: `✂️ Cut ${seg.type === "breath" ? "(breath)" : "(silence)"}`,
            effectType: "transition-cut",
          },
        });
      });
    }
  }, []);

  // ── Cleanup: Noise Removal settings change ──
  const handleNoiseRemovalChange = useCallback((settings: NoiseRemovalSettings) => {
    setNoiseRemovalSettings(settings);
    setAudioSettings((prev) => ({ ...prev, noiseRemoval: settings }));
  }, []);

  // ── Ruler click ────────────────────────────────────
  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (timelineBodyRef.current?.scrollLeft ?? 0);
      const time = x / pixelsPerSecond;
      dispatch({ type: "SET_TIME", time: Math.max(0, Math.min(time, timeline.duration)) });
    },
    [pixelsPerSecond, timeline.duration]
  );

  // ── Track meta ─────────────────────────────────────
  const updateTrackMeta = useCallback(
    (idx: number, update: Partial<(typeof trackMetas)[0]>) =>
      setTrackMetas((prev) => ({ ...prev, [idx]: { ...prev[idx], ...update } })),
    []
  );

  // ── Step navigation ────────────────────────────────
  const goToStep = useCallback(
    (step: Step) => {
      if (step < currentStep) {
        setCurrentStep(step);
        if (step === 1) {
          setEditingMode(null);
          setExpandedMode(null);
        }
      }
    },
    [currentStep]
  );

  // ═════════════════════════════════════════════════════
  // RENDER: HEADER (shared across steps)
  // ═════════════════════════════════════════════════════

  const renderHeader = () => (
    <header
      style={{
        height: isMobile ? 48 : 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 24px",
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(17,17,19,0.85)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
        <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: ACCENT }}>◉</span>
        {!isMobile && <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Cineflow</span>}
      </div>

      {currentStep === 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8, flex: 1, justifyContent: "center", minWidth: 0 }}>
          {!isMobile && (
            <>
              <button
                onClick={() => goToStep(2)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Back
              </button>
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
            </>
          )}
          {isEditingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
              style={{
                background: "rgba(139,92,246,0.1)",
                border: `1px solid rgba(139,92,246,0.3)`,
                borderRadius: 6,
                padding: "4px 8px",
                color: "#fff",
                fontSize: isMobile ? 16 : 13,
                outline: "none",
                fontFamily: "inherit",
                width: isMobile ? 140 : 200,
              }}
            />
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              style={{
                fontSize: isMobile ? 13 : 13,
                color: "rgba(255,255,255,0.7)",
                cursor: "text",
                padding: "4px 8px",
                borderRadius: 6,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: isMobile ? 120 : 200,
              }}
            >
              {projectName}
            </span>
          )}
          {/* Save indicator */}
          {showSavedIndicator && (
            <span
              style={{
                fontSize: 11,
                color: "#22c55e",
                fontWeight: 600,
                animation: "saved-fade-in 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              💾 Saved!
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
        {currentStep === 3 && (
          <>
            {!isMobile && (
              <>
                <button
                  onClick={() => dispatch({ type: "SET_PLAYING", playing: !timeline.playing })}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "none",
                    background: timeline.playing
                      ? "linear-gradient(135deg, #ef4444, #dc2626)"
                      : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    boxShadow: timeline.playing ? "0 0 16px rgba(239,68,68,0.3)" : "0 0 16px rgba(139,92,246,0.3)",
                  }}
                >
                  {timeline.playing ? "⏸" : "▶"}
                </button>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.7)",
                    minWidth: 90,
                    textAlign: "center",
                  }}
                >
                  {formatTime(timeline.currentTime)} / <span style={{ color: "rgba(255,255,255,0.35)" }}>{formatTime(timeline.duration)}</span>
                </span>
                <button
                  onClick={() => dispatch({ type: "UNDO" })}
                  disabled={hist.past.length === 0}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "none",
                    background: "rgba(255,255,255,0.04)",
                    color: hist.past.length === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                    cursor: hist.past.length === 0 ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  ↩
                </button>
                <button
                  onClick={() => dispatch({ type: "REDO" })}
                  disabled={hist.future.length === 0}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "none",
                    background: "rgba(255,255,255,0.04)",
                    color: hist.future.length === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                    cursor: hist.future.length === 0 ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  ↪
                </button>
              </>
            )}
            <button
              onClick={() => setShowExport(true)}
              style={{
                padding: isMobile ? "6px 10px" : "6px 16px",
                borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 12px rgba(139,92,246,0.3)",
                minHeight: 44,
              }}
            >
              🚀 {isMobile ? "" : "Export"}
            </button>
          </>
        )}
      </div>
    </header>
  );

  // ═════════════════════════════════════════════════════
  // RENDER: STEP 1 — UPLOAD
  // ═════════════════════════════════════════════════════

  const renderStep1 = () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 16 : 24 }}>
      <div style={{ maxWidth: 600, width: "100%" }}>
        {!uploadedFile ? (
          /* Drop zone */
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? ACCENT : "rgba(139,92,246,0.3)"}`,
              borderRadius: 24,
              padding: "72px 32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.3s",
              background: isDragging ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.02)",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                margin: "0 auto 24px",
                borderRadius: 24,
                background: "rgba(139,92,246,0.1)",
                border: `1px solid rgba(139,92,246,0.2)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
              }}
            >
              🎬
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
              Drag & drop your video here
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>
              or click to browse · MP4, MOV, WebM
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>
        ) : (
          /* Video preview + file info */
          <div style={{ animation: "slide-up 0.4s ease" }}>
            {/* Video preview */}
            <div
              style={{
                borderRadius: 20,
                overflow: "hidden",
                border: `1px solid ${BORDER}`,
                background: "#000",
                marginBottom: 20,
              }}
            >
              <video
                ref={videoPreviewRef}
                src={uploadedFile.url}
                controls
                style={{ width: "100%", display: "block", maxHeight: 360 }}
                playsInline
              />
            </div>

            {/* File info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.02)",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 28 }}>🎥</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {uploadedFile.name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {formatFileSize(uploadedFile.size)} · {formatDuration(uploadedFile.duration)}
                </div>
              </div>
              <button
                onClick={() => {
                  URL.revokeObjectURL(uploadedFile.url);
                  setUploadedFile(null);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ✕ Remove
              </button>
            </div>

            {/* Next button */}
            <button
              onClick={() => setCurrentStep(2)}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 14,
                border: "none",
                background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 24px rgba(139,92,246,0.3)",
                transition: "all 0.2s",
              }}
            >
              Toliau →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ═════════════════════════════════════════════════════
  // RENDER: STEP 2 — MODE SELECTION
  // ═════════════════════════════════════════════════════

  const renderStep2 = () => {
    if (isProcessing) {
      return (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ProcessingView videoUrl={uploadedFile?.url || ""} steps={processingSteps} errors={processingErrors} />
        </div>
      );
    }

    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {/* Video thumbnail + name */}
          {uploadedFile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 28,
                padding: "12px 16px",
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#000",
                }}
              >
                <video src={uploadedFile.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{uploadedFile.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {formatFileSize(uploadedFile.size)} · {formatDuration(uploadedFile.duration)}
                </div>
              </div>
            </div>
          )}

          {/* Mode cards */}
          <div style={{ display: "flex", gap: isMobile ? 12 : 16, marginBottom: isMobile ? 20 : 32, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
            <ModeCard
              icon="🤖"
              title="AI Full Auto"
              description="AI viską padarys: subtitrus, B-roll, zoom, muziką, efektus"
              selected={expandedMode === "ai-full-auto"}
              onClick={() => {
                setEditingMode("ai-full-auto");
                setExpandedMode(expandedMode === "ai-full-auto" ? null : "ai-full-auto");
              }}
            />
            <ModeCard
              icon="🎨"
              title="Reference Clone"
              description="Įkelk reference video — AI atkartoja to kūrėjo stilių ant tavo video"
              selected={expandedMode === "reference-clone"}
              onClick={() => {
                setEditingMode("reference-clone");
                setExpandedMode(expandedMode === "reference-clone" ? null : "reference-clone");
              }}
            />
            <ModeCard
              icon="✏️"
              title="Tik Subtitrai"
              description="Uždeda subtitrus ir eini pats redaguoti editoriuje"
              selected={expandedMode === "subtitles-only"}
              onClick={() => {
                setEditingMode("subtitles-only");
                setExpandedMode(expandedMode === "subtitles-only" ? null : "subtitles-only");
              }}
            />
          </div>

          {/* ═══ EXPANDED MODE: AI FULL AUTO ═══ */}
          {expandedMode === "ai-full-auto" && (
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: `1px solid rgba(139,92,246,0.2)`,
                background: "rgba(139,92,246,0.03)",
                backdropFilter: "blur(20px)",
                animation: "slide-up 0.3s ease",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                🤖 AI Full Auto — Nustatymai
              </h3>

              {/* Caption style */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Caption stilius
                </label>
                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    borderRadius: 14,
                    border: `1px solid ${BORDER}`,
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <SubtitlesEngine
                    onStyleSelect={handleStyleSelect}
                    onPositionChange={() => {}}
                    onTranscriptEdit={() => {}}
                    initialStyle={captionStyle || undefined}
                  />
                </div>
              </div>

              {/* AI Detail Level */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI detalumo lygis
                </label>
                <DetailLevelSelector value={aiDetailLevel} onChange={setAiDetailLevel} />
              </div>

              {/* B-roll model (only for standard/premium) */}
              {aiDetailLevel !== "quick" && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    B-roll modelis
                  </label>
                  <BrollModelSelector value={brollModel} onChange={setBrollModel} />
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={() => startProcessing("ai-full-auto", aiDetailLevel)}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(139,92,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                🚀 Generuoti
              </button>
            </div>
          )}

          {/* ═══ EXPANDED MODE: REFERENCE CLONE ═══ */}
          {expandedMode === "reference-clone" && (
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: `1px solid rgba(139,92,246,0.2)`,
                background: "rgba(139,92,246,0.03)",
                backdropFilter: "blur(20px)",
                animation: "slide-up 0.3s ease",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                🎨 Reference Clone — Nustatymai
              </h3>

              {/* Reference video upload */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Reference Video
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <div
                    onClick={() => refVideoInputRef.current?.click()}
                    style={{
                      flex: 1,
                      padding: "20px 16px",
                      borderRadius: 14,
                      border: `2px dashed ${referenceVideoUrl ? "rgba(34,197,94,0.3)" : BORDER}`,
                      background: referenceVideoUrl ? "rgba(34,197,94,0.03)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: referenceVideoUrl ? "#22c55e" : "#fff" }}>
                      {referenceVideoUrl ? "✅ Reference įkeltas" : "📂 Upload reference video"}
                    </div>
                    <input
                      ref={refVideoInputRef}
                      type="file"
                      accept="video/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setReferenceVideoUrl(URL.createObjectURL(f));
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={youtubeRefUrl}
                      onChange={(e) => {
                        setYoutubeRefUrl(e.target.value);
                        if (e.target.value.trim()) setReferenceVideoUrl(e.target.value.trim());
                      }}
                      placeholder="arba YouTube URL..."
                      style={{
                        width: "100%",
                        padding: "16px 14px",
                        borderRadius: 14,
                        border: `1px solid ${BORDER}`,
                        background: "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Reference screenshot */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Reference Screenshot (caption stiliui)
                </label>
                <div
                  onClick={() => refScreenshotInputRef.current?.click()}
                  style={{
                    padding: "16px",
                    borderRadius: 14,
                    border: `2px dashed ${referenceScreenshot ? "rgba(34,197,94,0.3)" : BORDER}`,
                    background: referenceScreenshot ? "rgba(34,197,94,0.03)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: referenceScreenshot ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
                    {referenceScreenshot ? "✅ Screenshot įkeltas" : "🖼️ Upload screenshot"}
                  </div>
                  <input
                    ref={refScreenshotInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setReferenceScreenshot(URL.createObjectURL(f));
                    }}
                  />
                </div>
              </div>

              {/* Detail level */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI detalumo lygis
                </label>
                <DetailLevelSelector value={aiDetailLevel} onChange={setAiDetailLevel} />
              </div>

              {/* B-roll model */}
              {aiDetailLevel !== "quick" && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    B-roll modelis
                  </label>
                  <BrollModelSelector value={brollModel} onChange={setBrollModel} />
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={() => startProcessing("reference-clone", aiDetailLevel)}
                disabled={!referenceVideoUrl}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: !referenceVideoUrl
                    ? "rgba(139,92,246,0.2)"
                    : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                  color: !referenceVideoUrl ? "rgba(255,255,255,0.4)" : "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: !referenceVideoUrl ? "not-allowed" : "pointer",
                  boxShadow: referenceVideoUrl ? "0 4px 24px rgba(139,92,246,0.3)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                🎨 Klonuoti stilių
              </button>
            </div>
          )}

          {/* ═══ EXPANDED MODE: SUBTITLES ONLY ═══ */}
          {expandedMode === "subtitles-only" && (
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: `1px solid rgba(139,92,246,0.2)`,
                background: "rgba(139,92,246,0.03)",
                backdropFilter: "blur(20px)",
                animation: "slide-up 0.3s ease",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                ✏️ Tik Subtitrai — Nustatymai
              </h3>

              {/* Caption style */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Caption stilius
                </label>
                <div
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    borderRadius: 14,
                    border: `1px solid ${BORDER}`,
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <SubtitlesEngine
                    onStyleSelect={handleStyleSelect}
                    onPositionChange={() => {}}
                    onTranscriptEdit={() => {}}
                    initialStyle={captionStyle || undefined}
                  />
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={() => startProcessing("subtitles-only", "quick")}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(139,92,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                ✏️ Pradėti
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═════════════════════════════════════════════════════
  // RENDER: STEP 3 — EDITOR
  // ═════════════════════════════════════════════════════

  const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string; icon: string }[] = [
    { id: "subtitles", label: "Subtitles", icon: "📝" },
    { id: "broll", label: "B-Roll", icon: "🎞️" },
    { id: "effects", label: "Effects", icon: "✨" },
    { id: "audio", label: "Audio", icon: "🎵" },
  ];

  const renderStep3 = () => {
    // ─── MOBILE LAYOUT ───────────────────────────────
    if (isMobile) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* ── MOBILE: Video Preview (full width) ── */}
          <div style={{ position: "relative", width: "100%", flexShrink: 0, background: "#000" }}>
            <video
              ref={editorVideoRef}
              src={uploadedFile?.url || ""}
              style={{
                width: "100%",
                maxHeight: "35vh",
                objectFit: "contain",
                display: "block",
                filter: activeFilterCSS || undefined,
                transform: activeZoomCSS || undefined,
                transition: `${activeZoomTransition || "transform 0.3s ease"}, filter 0.5s ease`,
              }}
              controls={false}
              autoPlay={false}
              preload="metadata"
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onClick={() => dispatch({ type: "SET_PLAYING", playing: !timeline.playing })}
            />
            {/* Filter overlay */}
            {activeFilterOverlay && (
              <div style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", ...activeFilterOverlay }} />
            )}
            {/* Subtitle overlay */}
            {activeSubtitle && (
              <div
                style={{
                  position: "absolute",
                  bottom: activeSubtitle.style?.position === "top" ? "auto" : activeSubtitle.style?.position === "center" ? "50%" : 30,
                  top: activeSubtitle.style?.position === "top" ? 30 : "auto",
                  left: "50%",
                  transform: activeSubtitle.style?.position === "center" ? "translate(-50%, 50%)" : "translateX(-50%)",
                  maxWidth: "90%",
                  textAlign: "center",
                  zIndex: 16,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: activeSubtitle.style?.backgroundColor || "transparent",
                    fontFamily: activeSubtitle.style?.fontFamily || "'Inter', sans-serif",
                    fontSize: Math.min(activeSubtitle.style?.fontSize || 18, 18),
                    fontWeight: activeSubtitle.style?.fontWeight || 700,
                    textShadow: activeSubtitle.style?.textShadow || "0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
                    textTransform: (activeSubtitle.style?.textTransform as React.CSSProperties["textTransform"]) || "none",
                    lineHeight: 1.4,
                    ...activeSubtitle.style?.customCSS,
                  }}
                >
                  {activeSubtitle.words && activeSubtitle.words.length > 0 ? (
                    activeSubtitle.words.map((word, i) => {
                      const isActive = timeline.currentTime >= word.start && timeline.currentTime < word.end;
                      const highlightColor = activeSubtitle.style?.highlightColor;
                      const baseColor = activeSubtitle.style?.color || "#fff";
                      return (
                        <span
                          key={i}
                          style={{
                            opacity: isActive ? 1 : 0.5,
                            color: isActive ? (highlightColor || baseColor) : baseColor,
                            transition: "opacity 0.1s, color 0.1s",
                            display: "inline-block",
                            marginRight: "0.2em",
                          }}
                        >
                          {word.word}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ color: activeSubtitle.style?.color || "#fff" }}>{activeSubtitle.label}</span>
                  )}
                </span>
              </div>
            )}
            {/* B-Roll overlay */}
            {activeBroll && activeBroll.src && (
              <video
                key={activeBroll.id}
                src={activeBroll.src}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 5, pointerEvents: "none" }}
                autoPlay muted playsInline loop
              />
            )}
          </div>

          {/* ── MOBILE: Mini playback bar ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderBottom: `1px solid ${BORDER}`,
              background: "rgba(0,0,0,0.4)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => dispatch({ type: "SET_PLAYING", playing: !timeline.playing })}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: timeline.playing
                  ? "linear-gradient(135deg, #ef4444, #dc2626)"
                  : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
                minHeight: 44,
              }}
            >
              {timeline.playing ? "⏸" : "▶"}
            </button>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.1)",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                dispatch({ type: "SET_TIME", time: ratio * timeline.duration });
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${(timeline.currentTime / Math.max(timeline.duration, 0.1)) * 100}%`,
                  borderRadius: 3,
                  background: ACCENT,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${(timeline.currentTime / Math.max(timeline.duration, 0.1)) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.7)",
                flexShrink: 0,
                minWidth: 70,
                textAlign: "right",
              }}
            >
              {formatTime(timeline.currentTime)} / {formatTime(timeline.duration)}
            </span>
          </div>

          {/* ── MOBILE: Tab bar (horizontal scroll, touch-friendly) ── */}
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              borderBottom: `1px solid ${BORDER}`,
              flexShrink: 0,
              background: "rgba(0,0,0,0.3)",
              scrollbarWidth: "none",
            }}
          >
            {RIGHT_PANEL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileTab(tab.id); }}
                style={{
                  flex: "0 0 auto",
                  width: 80,
                  padding: "10px 8px",
                  border: "none",
                  borderBottom: mobileTab === tab.id ? `3px solid ${ACCENT}` : "3px solid transparent",
                  background: mobileTab === tab.id ? "rgba(139,92,246,0.08)" : "transparent",
                  color: mobileTab === tab.id ? "#fff" : "rgba(255,255,255,0.45)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── MOBILE: Active tab content (scrollable panel) ── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              maxHeight: "40vh",
              background: PANEL,
            }}
          >
            {mobileTab === "subtitles" && (
              <SubtitlesEngine
                onStyleSelect={handleStyleSelect}
                onPositionChange={() => {}}
                onTranscriptEdit={() => {}}
                initialStyle={captionStyle || undefined}
              />
            )}
            {mobileTab === "broll" && (
              <BrollEngine transcript={transcript} suggestions={brollSuggestions} onAddClip={handleBrollAdd} currentTime={timeline.currentTime} />
            )}
            {mobileTab === "effects" && (
              <EffectsEngine
                selectedClipId={selectedClipIds.size === 1 ? Array.from(selectedClipIds)[0] : undefined}
                currentTime={timeline.currentTime}
                totalDuration={timeline.duration}
                onAddEffect={handleAddEffect}
                onFilterChange={handleFilterChange}
                onZoomChange={handleZoomChange}
                zoomMoments={zoomMoments}
              />
            )}
            {mobileTab === "audio" && (
              <AudioEngine
                audioUrl={uploadedFile?.url || ""}
                videoFile={uploadedFile?.file}
                transcript={transcript.map((s) => s.text).join(" ")}
                onSettingsChange={setAudioSettings}
                onAddTrack={handleAddMusicTrack}
                onSilenceRemoval={handleCleanupSilenceRemoval}
                onNoiseRemovalChange={handleNoiseRemovalChange}
              />
            )}
          </div>
        </div>
      );
    }

    // ─── DESKTOP LAYOUT (original) ───────────────────
    return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── TOP AREA: Preview + Right Panel ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* ── VIDEO PREVIEW ── */}
        <div
          style={{
            width: `${previewWidth}%`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: 8,
            position: "relative",
          }}
        >
          {/* ── Aspect Ratio Selector Bar ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              padding: "4px 6px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              flexShrink: 0,
              overflowX: "auto",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", marginRight: 2 }}>Format:</span>
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.id}
                onClick={() => setAspectRatio(ar.id)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: `1px solid ${aspectRatio === ar.id ? ACCENT : "transparent"}`,
                  background: aspectRatio === ar.id ? "rgba(139,92,246,0.15)" : "transparent",
                  color: aspectRatio === ar.id ? "#fff" : "rgba(255,255,255,0.45)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <span>{ar.icon}</span>
                {ar.id === "auto" ? "Auto" : ar.id}
              </button>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Aspect ratio frame container */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* Inner frame with target aspect ratio */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: aspectRatio === "auto" ? undefined : `${targetAspectRatio}`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: aspectRatio === "auto" ? "100%" : undefined,
                  height: aspectRatio === "auto" ? "100%" : undefined,
                  overflow: "hidden",
                  borderRadius: 8,
                  ...(aspectRatio !== "auto" && targetAspectRatio >= 1
                    ? { width: "100%", height: "auto" }
                    : aspectRatio !== "auto"
                      ? { height: "100%", width: "auto" }
                      : {}),
                }}
                ref={cropContainerRef}
                onMouseDown={needsCrop ? handleCropMouseDown : undefined}
              >
                {/* Real HTML5 video — with active filter, zoom, crop CSS */}
                <video
                  ref={editorVideoRef}
                  src={uploadedFile?.url || ""}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: needsCrop ? "cover" : "contain",
                    display: "block",
                    filter: activeFilterCSS || undefined,
                    transform: needsCrop
                      ? `scale(${cropPosition.scale}) translate(${cropPosition.x}px, ${cropPosition.y}px)${activeZoomCSS ? ` ${activeZoomCSS}` : ""}`
                      : activeZoomCSS || undefined,
                    transition: isDraggingCrop
                      ? "filter 0.5s ease"
                      : `${activeZoomTransition || "transform 0.3s ease"}, filter 0.5s ease`,
                    cursor: needsCrop ? (isDraggingCrop ? "grabbing" : "grab") : "pointer",
                  }}
                  controls={false}
                  autoPlay={false}
                  preload="metadata"
                  playsInline
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onClick={needsCrop ? undefined : () => dispatch({ type: "SET_PLAYING", playing: !timeline.playing })}
                />

                {/* Crop guide overlay when aspect mismatch */}
                {needsCrop && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 6,
                    }}
                  >
                    {/* Rule of thirds grid */}
                    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
                      <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="#fff" strokeWidth="0.5" />
                      <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="#fff" strokeWidth="0.5" />
                      <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="#fff" strokeWidth="0.5" />
                      <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="#fff" strokeWidth="0.5" />
                    </svg>
                    {/* Crop info badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "rgba(139,92,246,0.85)",
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}
                    >
                      {aspectRatio} · {cropPosition.scale.toFixed(1)}x
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter overlay (for vignette, cinematic bars, light leak, etc.) */}
            {activeFilterOverlay && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 4,
                  pointerEvents: "none",
                  borderRadius: 12,
                  ...activeFilterOverlay,
                }}
              />
            )}

            {/* Subtitle overlay — word-by-word highlight, no default background */}
            {activeSubtitle && (
              <div
                style={{
                  position: "absolute",
                  bottom: activeSubtitle.style?.position === "top" ? "auto" : activeSubtitle.style?.position === "center" ? "50%" : 40,
                  top: activeSubtitle.style?.position === "top" ? 40 : "auto",
                  left: "50%",
                  transform: activeSubtitle.style?.position === "center" ? "translate(-50%, 50%)" : "translateX(-50%)",
                  maxWidth: "80%",
                  textAlign: "center",
                  pointerEvents: editingSubtitleId === activeSubtitle.id ? "auto" : "auto",
                  zIndex: 16,
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editingSubtitleId !== activeSubtitle.id) {
                    setEditingSubtitleId(activeSubtitle.id);
                    dispatch({ type: "SET_PLAYING", playing: false });
                  }
                }}
              >
                {editingSubtitleId === activeSubtitle.id ? (
                  /* Inline editing mode */
                  <input
                    autoFocus
                    defaultValue={activeSubtitle.label || ""}
                    onBlur={(e) => {
                      const newText = e.target.value.trim();
                      if (newText && newText !== activeSubtitle.label) {
                        dispatch({
                          type: "UPDATE_CLIP",
                          clipId: activeSubtitle.id,
                          changes: { label: newText },
                        });
                      }
                      setEditingSubtitleId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        setEditingSubtitleId(null);
                      }
                    }}
                    style={{
                      background: "rgba(0,0,0,0.6)",
                      border: "2px solid #8B5CF6",
                      borderRadius: 8,
                      padding: "8px 16px",
                      color: activeSubtitle.style?.color || "#fff",
                      fontFamily: activeSubtitle.style?.fontFamily || "'Inter', sans-serif",
                      fontSize: activeSubtitle.style?.fontSize ? Math.min(activeSubtitle.style.fontSize, 24) : 18,
                      fontWeight: activeSubtitle.style?.fontWeight || 700,
                      textAlign: "center",
                      outline: "none",
                      minWidth: 120,
                      textTransform: (activeSubtitle.style?.textTransform as React.CSSProperties["textTransform"]) || "none",
                    }}
                  />
                ) : (
                  /* Display mode — word-by-word highlight */
                  <span
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: activeSubtitle.style?.backgroundColor || "transparent",
                      fontFamily: activeSubtitle.style?.fontFamily || "'Inter', sans-serif",
                      fontSize: activeSubtitle.style?.fontSize ? Math.min(activeSubtitle.style.fontSize, 24) : 18,
                      fontWeight: activeSubtitle.style?.fontWeight || 700,
                      textShadow: activeSubtitle.style?.textShadow || "0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
                      textTransform: (activeSubtitle.style?.textTransform as React.CSSProperties["textTransform"]) || "none",
                      WebkitTextStroke: activeSubtitle.style?.stroke || (!activeSubtitle.style?.backgroundColor ? "0.5px rgba(0,0,0,0.8)" : undefined),
                      lineHeight: 1.4,
                      ...activeSubtitle.style?.customCSS,
                    }}
                  >
                    {activeSubtitle.words && activeSubtitle.words.length > 0 ? (
                      activeSubtitle.words.map((word, i) => {
                        const isActive = timeline.currentTime >= word.start && timeline.currentTime < word.end;
                        const highlightColor = activeSubtitle.style?.highlightColor;
                        const baseColor = activeSubtitle.style?.color || "#fff";
                        return (
                          <span
                            key={i}
                            style={{
                              opacity: isActive ? 1 : 0.5,
                              color: isActive ? (highlightColor || baseColor) : baseColor,
                              transition: "opacity 0.1s, color 0.1s, transform 0.1s",
                              display: "inline-block",
                              transform: isActive ? "scale(1.05)" : "scale(1)",
                              marginRight: "0.2em",
                            }}
                          >
                            {word.word}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ color: activeSubtitle.style?.color || "#fff" }}>
                        {activeSubtitle.label}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* B-Roll overlay — shows B-Roll video on top of main video when active */}
            {activeBroll && activeBroll.src && (
              <video
                key={activeBroll.id}
                src={activeBroll.src}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 5,
                  pointerEvents: "none",
                  borderRadius: 12,
                }}
                autoPlay
                muted
                playsInline
                loop
              />
            )}

            {/* B-Roll label badge */}
            {activeBroll && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 15,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "rgba(139, 92, 246, 0.85)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  pointerEvents: "none",
                }}
              >
                🎞️ B-ROLL
              </div>
            )}

            {/* Video controls overlay */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "8px 12px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                display: "flex",
                alignItems: "center",
                gap: 8,
                zIndex: 20,
              }}
            >
              <button
                onClick={() => dispatch({ type: "SET_PLAYING", playing: !timeline.playing })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {timeline.playing ? "⏸" : "▶"}
              </button>

              {/* Seek bar */}
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  position: "relative",
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  dispatch({ type: "SET_TIME", time: ratio * timeline.duration });
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${(timeline.currentTime / Math.max(timeline.duration, 0.1)) * 100}%`,
                    borderRadius: 2,
                    background: ACCENT,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${(timeline.currentTime / Math.max(timeline.duration, 0.1)) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.7)",
                  flexShrink: 0,
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {formatTime(timeline.currentTime)} / {formatTime(timeline.duration)}
              </span>

              {/* Speed indicator */}
              {playbackSpeed !== 1 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: ACCENT,
                    flexShrink: 0,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(139,92,246,0.2)",
                  }}
                >
                  {playbackSpeed}x
                </span>
              )}
            </div>
          </div>

          {/* ── Speed Control Bar (below video preview) ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              padding: "4px 6px",
              marginTop: 4,
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              flexShrink: 0,
            }}
          >
            <SpeedControl value={playbackSpeed} onChange={setPlaybackSpeed} />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={handleSplit}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                ✂️ Split
              </button>
            </div>
          </div>
        </div>

        {/* ── HORIZONTAL RESIZE HANDLE ── */}
        <div
          onMouseDown={startResizeH}
          style={{
            width: 6,
            cursor: "col-resize",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ width: 2, height: 40, borderRadius: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderLeft: `1px solid ${BORDER}`,
            background: PANEL,
            minWidth: 320,
          }}
        >
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: "rgba(0,0,0,0.3)" }}>
            {RIGHT_PANEL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  border: "none",
                  borderBottom: activeTab === tab.id ? `2px solid ${ACCENT}` : "2px solid transparent",
                  background: activeTab === tab.id ? "rgba(139,92,246,0.05)" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {activeTab === "subtitles" && (
              <SubtitlesEngine
                onStyleSelect={handleStyleSelect}
                onPositionChange={() => {}}
                onTranscriptEdit={() => {}}
                initialStyle={captionStyle || undefined}
              />
            )}
            {activeTab === "broll" && (
              <BrollEngine transcript={transcript} suggestions={brollSuggestions} onAddClip={handleBrollAdd} currentTime={timeline.currentTime} />
            )}
            {activeTab === "effects" && (
              <EffectsEngine
                selectedClipId={selectedClipIds.size === 1 ? Array.from(selectedClipIds)[0] : undefined}
                currentTime={timeline.currentTime}
                totalDuration={timeline.duration}
                onAddEffect={handleAddEffect}
                onFilterChange={handleFilterChange}
                onZoomChange={handleZoomChange}
                zoomMoments={zoomMoments}
              />
            )}
            {activeTab === "audio" && (
              <AudioEngine
                audioUrl={uploadedFile?.url || ""}
                videoFile={uploadedFile?.file}
                transcript={transcript.map((s) => s.text).join(" ")}
                onSettingsChange={setAudioSettings}
                onAddTrack={handleAddMusicTrack}
                onSilenceRemoval={handleCleanupSilenceRemoval}
                onNoiseRemovalChange={handleNoiseRemovalChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── VERTICAL RESIZE HANDLE ── */}
      <div
        onMouseDown={startResizeV}
        style={{
          height: 6,
          cursor: "row-resize",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ width: 40, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.1)" }} />
      </div>

      {/* ══════ TIMELINE ══════ */}
      <div
        style={{
          height: timelineHeight,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderTop: `1px solid ${BORDER}`,
          background: "#0d0d15",
          overflow: "hidden",
        }}
      >
        {/* Timeline toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 12px",
            borderBottom: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.02)",
            flexShrink: 0,
            height: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => dispatch({ type: "SET_ZOOM", zoom: timeline.zoom - 0.2 })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", width: 36, textAlign: "center" }}>
              {Math.round(timeline.zoom * 100)}%
            </span>
            <button
              onClick={() => dispatch({ type: "SET_ZOOM", zoom: timeline.zoom + 0.2 })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => {
                selectedClipIds.forEach((id) =>
                  dispatch({ type: "SPLIT_CLIP", clipId: id, splitAt: timeline.currentTime })
                );
              }}
              disabled={selectedClipIds.size === 0}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border: "none",
                background: "transparent",
                color: selectedClipIds.size === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                fontSize: 11,
                fontWeight: 500,
                cursor: selectedClipIds.size === 0 ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              ✂ Split
            </button>
            <button
              onClick={() => {
                selectedClipIds.forEach((id) => dispatch({ type: "REMOVE_CLIP", clipId: id }));
                setSelectedClipIds(new Set());
              }}
              disabled={selectedClipIds.size === 0}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border: "none",
                background: "transparent",
                color: selectedClipIds.size === 0 ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.7)",
                fontSize: 11,
                fontWeight: 500,
                cursor: selectedClipIds.size === 0 ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              🗑 Delete
            </button>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)", margin: "0 4px" }} />
            <button
              onClick={() => setSnapEnabled((v) => !v)}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border: "none",
                background: snapEnabled ? "rgba(139,92,246,0.15)" : "transparent",
                color: snapEnabled ? "#A78BFA" : "rgba(255,255,255,0.3)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              🧲 Snap
            </button>
          </div>
        </div>

        {/* Timeline body with ruler + tracks */}
        <div
          ref={timelineBodyRef}
          style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}
          onClick={(e) => {
            if ((e.target as HTMLElement).dataset.timeline) setSelectedClipIds(new Set());
          }}
        >
          {/* Ruler */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              height: 24,
              width: totalWidth + 160,
              background: "#0a0a14",
              borderBottom: `1px solid ${BORDER}`,
              cursor: "pointer",
            }}
            onClick={handleRulerClick}
          >
            <div style={{ position: "absolute", left: 160, right: 0, height: "100%" }}>
              {rulerMarks.map((mark) => (
                <div
                  key={mark.time}
                  style={{
                    position: "absolute",
                    left: mark.time * pixelsPerSecond,
                    top: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "monospace",
                      marginTop: 2,
                      userSelect: "none",
                    }}
                  >
                    {mark.label}
                  </span>
                  <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
              ))}
              <div style={{ position: "absolute", left: timeline.currentTime * pixelsPerSecond - 5, top: 0, zIndex: 40 }}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill="#ef4444">
                  <polygon points="0,0 10,0 5,10" />
                </svg>
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div style={{ position: "relative", width: totalWidth + 160 }} data-timeline="true">
            {TRACKS.map((trackType, idx) => (
              <TimelineTrack
                key={trackType}
                trackType={trackType}
                trackIndex={idx}
                clips={clipsPerTrack[idx] || []}
                zoom={timeline.zoom}
                pixelsPerSecond={pixelsPerSecond}
                selectedClipIds={selectedClipIds}
                isMuted={trackMetas[idx]?.muted ?? false}
                isSolo={trackMetas[idx]?.solo ?? false}
                isLocked={trackMetas[idx]?.locked ?? false}
                volume={trackMetas[idx]?.volume ?? 0.8}
                onClipMouseDown={handleClipMouseDown}
                onToggleMute={() => updateTrackMeta(idx, { muted: !trackMetas[idx]?.muted })}
                onToggleSolo={() => updateTrackMeta(idx, { solo: !trackMetas[idx]?.solo })}
                onToggleLock={() => updateTrackMeta(idx, { locked: !trackMetas[idx]?.locked })}
                onVolumeChange={(v) => updateTrackMeta(idx, { volume: v })}
                onTrackDrop={() => {}}
                onTrackDragOver={(e) => e.preventDefault()}
              />
            ))}

            {/* Playhead line */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 2,
                left: 160 + timeline.currentTime * pixelsPerSecond,
                background: "#ef4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)",
                zIndex: 40,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 6px rgba(239,68,68,0.8)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Keyboard hints */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "4px 0",
            flexShrink: 0,
            opacity: 0.25,
          }}
        >
          {[
            ["Space", "Play/Pause"],
            ["←→", "Frame"],
            ["S", "Split"],
            ["Del", "Remove"],
            ["⌘Z", "Undo"],
            ["J/K/L", "Speed"],
          ].map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <kbd
                style={{
                  padding: "1px 5px",
                  borderRadius: 3,
                  fontSize: 9,
                  fontFamily: "monospace",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  // ═════════════════════════════════════════════════════
  // DRAFT DIALOG
  // ═════════════════════════════════════════════════════

  const renderDraftDialog = () => {
    if (!showDraftDialog || !pendingDraft) return null;
    const d = pendingDraft;
    const savedAt = d.savedAt as number;
    const age = Date.now() - savedAt;
    const ageText = age < 3600000
      ? `${Math.round(age / 60000)} min. prieš`
      : age < 86400000
        ? `${Math.round(age / 3600000)} val. prieš`
        : "seniai";
    const tl = d.timeline as { clips?: unknown[] } | undefined;
    const clipCount = tl?.clips?.length || 0;
    const subCount = tl?.clips
      ? (tl.clips as Array<{ trackType?: string }>).filter((c) => c.trackType === "subtitle").length
      : 0;
    const fxCount = tl?.clips
      ? (tl.clips as Array<{ trackType?: string }>).filter((c) => c.trackType === "effect").length
      : 0;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: isMobile ? "24px 20px" : "32px 36px",
            maxWidth: 420,
            width: "90%",
            textAlign: "center",
            animation: "slide-up 0.3s ease",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            Nebaigtas projektas
          </h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>
            &ldquo;{(d.projectName as string) || "Untitled"}&rdquo; — {ageText}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 24px" }}>
            {subCount} subtitle clips, {fxCount} effects, {clipCount} total
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={restoreDraft}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Tęsti redagavimą
            </button>
            <button
              onClick={dismissDraft}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Naujas
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═════════════════════════════════════════════════════
  // MAIN RENDER
  // ═════════════════════════════════════════════════════

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: BG,
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#fff",
      }}
    >
      {/* Global header */}
      {renderHeader()}

      {/* Step indicator (Steps 1 & 2 only) */}
      {currentStep < 3 && <StepIndicator currentStep={currentStep} onStepClick={goToStep} />}

      {/* Step content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

      {/* Export Modal */}
      {showExport && uploadedFile && (
        <ExportModalComponent
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          videoUrl={uploadedFile.url}
          segments={transcript}
          captionStyle={
            captionStyle || {
              id: "classic-clean-white",
              name: "Clean White",
              category: "classic",
              fontFamily: "'Inter', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              position: "bottom",
              animation: "none",
              preview: "Hello World",
            }
          }
        />
      )}

      {/* Draft Dialog */}
      {renderDraftDialog()}
    </div>
  );
}
