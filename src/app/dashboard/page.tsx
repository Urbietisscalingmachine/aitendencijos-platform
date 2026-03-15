"use client";

/* ═══════════════════════════════════════════════════════════
   CINEFLOW DASHBOARD — Full NLE-style editor
   Integrates: SubtitlesEngine, TimelineEditor, TimelineTrack,
   PlaybackPreview, BrollEngine, EffectsEngine, AudioEngine,
   AudioWaveform, EffectsPanel + shared types
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

// ── Types ───────────────────────────────────────────────
import type {
  CineflowProject,
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
  MusicTrack,
  SilenceSegment,
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

type WorkflowState = "upload" | "processing" | "editor" | "export";
type RightPanelTab = "subtitles" | "broll" | "effects" | "audio";
type UploadMode = "single" | "clone" | "youtube";

interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

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
            ? {
                ...c,
                startTime: Math.max(0, action.startTime),
                trackIndex: action.trackIndex,
              }
            : c
        ),
      };
    case "TRIM_CLIP":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId
            ? {
                ...c,
                startTime: Math.max(0, action.startTime),
                duration: Math.max(0.1, action.duration),
              }
            : c
        ),
      };
    case "SPLIT_CLIP": {
      const clip = state.clips.find((c) => c.id === action.clipId);
      if (!clip) return state;
      const splitPoint = action.splitAt;
      if (
        splitPoint <= clip.startTime ||
        splitPoint >= clip.startTime + clip.duration
      )
        return state;
      const leftDur = splitPoint - clip.startTime;
      const rightDur = clip.duration - leftDur;
      const leftClip: TimelineClip = { ...clip, duration: leftDur };
      const rightClip: TimelineClip = {
        ...clip,
        id: clip.id + "_R" + Date.now(),
        startTime: splitPoint,
        duration: rightDur,
        sourceStart: (clip.sourceStart ?? 0) + leftDur,
      };
      return {
        ...state,
        clips: state.clips
          .map((c) => (c.id === clip.id ? leftClip : c))
          .concat(rightClip),
      };
    }
    case "SET_TIME":
      return {
        ...state,
        currentTime: Math.max(0, Math.min(action.time, state.duration)),
      };
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

function historyReducer(
  hist: HistoryState,
  action: TimelineAction
): HistoryState {
  if (action.type === "UNDO") {
    if (hist.past.length === 0) return hist;
    const prev = hist.past[hist.past.length - 1];
    return {
      past: hist.past.slice(0, -1),
      present: prev,
      future: [hist.present, ...hist.future].slice(0, MAX_HISTORY),
    };
  }
  if (action.type === "REDO") {
    if (hist.future.length === 0) return hist;
    const next = hist.future[0];
    return {
      past: [...hist.past, hist.present].slice(-MAX_HISTORY),
      present: next,
      future: hist.future.slice(1),
    };
  }
  if (
    action.type === "SET_TIME" ||
    action.type === "SET_PLAYING" ||
    action.type === "SET_ZOOM"
  ) {
    return { ...hist, present: timelineReducer(hist.present, action) };
  }
  const newPresent = timelineReducer(hist.present, action);
  return {
    past: [...hist.past, hist.present].slice(-MAX_HISTORY),
    present: newPresent,
    future: [],
  };
}

// ═════════════════════════════════════════════════════════
// INITIAL TIMELINE STATE
// ═════════════════════════════════════════════════════════

const EMPTY_TIMELINE: TimelineState = {
  clips: [],
  tracks: TRACKS,
  duration: 30,
  currentTime: 0,
  zoom: 1,
  playing: false,
};

// ═════════════════════════════════════════════════════════
// HELPER: uid generator
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

// ═════════════════════════════════════════════════════════
// EXPORT MODAL
// ═════════════════════════════════════════════════════════

function ExportModal({
  onClose,
  onExport,
  exporting,
  exportProgress,
}: {
  onClose: () => void;
  onExport: (settings: {
    resolution: string;
    format: string;
    aspectRatio: string;
  }) => void;
  exporting: boolean;
  exportProgress: number;
}) {
  const [resolution, setResolution] = useState("1080p");
  const [format] = useState("mp4");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: PANEL,
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          padding: 32,
          width: 440,
          maxWidth: "90vw",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 24px",
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: ACCENT }}>⬇</span> Export Video
        </h2>

        {/* Resolution */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Resolution
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {["720p", "1080p"].map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${resolution === res ? ACCENT : BORDER}`,
                  background:
                    resolution === res
                      ? "rgba(139,92,246,0.15)"
                      : "rgba(255,255,255,0.03)",
                  color: resolution === res ? ACCENT : "rgba(255,255,255,0.6)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Aspect Ratio
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { value: "16:9", label: "16:9 YouTube" },
              { value: "9:16", label: "9:16 Reels" },
              { value: "1:1", label: "1:1 Square" },
            ].map((ar) => (
              <button
                key={ar.value}
                onClick={() => setAspectRatio(ar.value)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${aspectRatio === ar.value ? ACCENT : BORDER}`,
                  background:
                    aspectRatio === ar.value
                      ? "rgba(139,92,246,0.15)"
                      : "rgba(255,255,255,0.03)",
                  color:
                    aspectRatio === ar.value
                      ? ACCENT
                      : "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format display */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Format
          </label>
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
            }}
          >
            MP4 (H.264)
          </div>
        </div>

        {/* Progress bar */}
        {exporting && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Exporting...
              </span>
              <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>
                {Math.round(exportProgress)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${exportProgress}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${ACCENT}, #A78BFA)`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onExport({ resolution, format, aspectRatio })}
            disabled={exporting}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: exporting
                ? "rgba(139,92,246,0.3)"
                : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: exporting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: exporting
                ? "none"
                : "0 4px 20px rgba(139,92,246,0.3)",
            }}
          >
            {exporting ? "Exporting..." : "🚀 Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═════════════════════════════════════════════════════════

export default function CineflowDashboard() {
  // ── Workflow state ──────────────────────────────────
  const [workflow, setWorkflow] = useState<WorkflowState>("upload");
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [activeTab, setActiveTab] = useState<RightPanelTab>("subtitles");

  // ── Project state ──────────────────────────────────
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditingName, setIsEditingName] = useState(false);
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // ── Transcript ─────────────────────────────────────
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);

  // ── Caption style ──────────────────────────────────
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle | null>(null);

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

  // ── B-Roll suggestions ─────────────────────────────
  const [brollSuggestions, setBrollSuggestions] = useState<BrollSuggestion[]>(
    []
  );

  // ── Timeline (with undo/redo) ──────────────────────
  const [hist, dispatch] = useReducer(historyReducer, {
    past: [],
    present: EMPTY_TIMELINE,
    future: [],
  });
  const timeline = hist.present;

  // ── Timeline UI state ──────────────────────────────
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(
    new Set()
  );
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [trackMetas, setTrackMetas] = useState<
    Record<number, { muted: boolean; solo: boolean; locked: boolean; volume: number }>
  >(() => {
    const m: Record<
      number,
      { muted: boolean; solo: boolean; locked: boolean; volume: number }
    > = {};
    TRACKS.forEach((_, i) => (m[i] = { muted: false, solo: false, locked: false, volume: 0.8 }));
    return m;
  });

  // ── Processing state ───────────────────────────────
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: "upload", label: "Uploading video", status: "pending" },
    { id: "transcribe", label: "Transcribing (Whisper)", status: "pending" },
    { id: "analyze", label: "Analyzing (Claude)", status: "pending" },
    { id: "ready", label: "Ready", status: "pending" },
  ]);

  // ── Export state ───────────────────────────────────
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ── Resize state ───────────────────────────────────
  const [previewWidth, setPreviewWidth] = useState(60); // percentage
  const [timelineHeight, setTimelineHeight] = useState(280); // pixels
  const isResizingH = useRef(false);
  const isResizingV = useRef(false);

  // ── Refs ───────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
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
      marks.push({
        time: t,
        label: `${m}:${s.toString().padStart(2, "0")}`,
        major: true,
      });
    }
    return marks;
  }, [timeline.duration, pixelsPerSecond]);

  // ═════════════════════════════════════════════════════
  // PLAYBACK TIMER
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    if (timeline.playing) {
      playIntervalRef.current = setInterval(() => {
        dispatch({
          type: "SET_TIME",
          time: timeline.currentTime + FRAME_DURATION,
        });
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
    (
      e: React.MouseEvent,
      clip: TimelineClip,
      edge: "left" | "right" | "body"
    ) => {
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
          const newTrackIdx = Math.max(
            0,
            Math.min(TRACKS.length - 1, dragRef.current.origTrackIndex + trackDelta)
          );
          dispatch({
            type: "MOVE_CLIP",
            clipId: dragRef.current.clipId,
            startTime: Math.max(0, snapped),
            trackIndex: newTrackIdx,
          });
        } else if (dragRef.current.edge === "left") {
          const rawStart = dragRef.current.origStart + dt;
          const snapped = snapTime(rawStart, dragRef.current.clipId);
          const maxStart =
            dragRef.current.origStart + dragRef.current.origDuration - 0.1;
          const newStart = Math.max(0, Math.min(snapped, maxStart));
          const newDur =
            dragRef.current.origDuration -
            (newStart - dragRef.current.origStart);
          dispatch({
            type: "TRIM_CLIP",
            clipId: dragRef.current.clipId,
            startTime: newStart,
            duration: newDur,
          });
        } else {
          const rawDur = dragRef.current.origDuration + dt;
          const snapped = snapTime(
            dragRef.current.origStart + rawDur,
            dragRef.current.clipId
          );
          const newDur = Math.max(
            0.1,
            snapped - dragRef.current.origStart
          );
          dispatch({
            type: "TRIM_CLIP",
            clipId: dragRef.current.clipId,
            startTime: dragRef.current.origStart,
            duration: newDur,
          });
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
  // KEYBOARD SHORTCUTS
  // ═════════════════════════════════════════════════════

  useEffect(() => {
    if (workflow !== "editor") return;
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
          dispatch({
            type: "SET_TIME",
            time: timeline.currentTime - FRAME_DURATION,
          });
          break;
        }
        case e.code === "ArrowRight": {
          e.preventDefault();
          dispatch({
            type: "SET_TIME",
            time: timeline.currentTime + FRAME_DURATION,
          });
          break;
        }
        case (e.code === "Delete" || e.code === "Backspace") &&
          selectedClipIds.size > 0: {
          e.preventDefault();
          selectedClipIds.forEach((id) =>
            dispatch({ type: "REMOVE_CLIP", clipId: id })
          );
          setSelectedClipIds(new Set());
          break;
        }
        case e.code === "KeyZ" &&
          (e.ctrlKey || e.metaKey) &&
          e.shiftKey: {
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
          selectedClipIds.forEach((id) => {
            dispatch({
              type: "SPLIT_CLIP",
              clipId: id,
              splitAt: timeline.currentTime,
            });
          });
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workflow, timeline.playing, timeline.currentTime, selectedClipIds]);

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
  // RESIZE HANDLERS (horizontal split + timeline height)
  // ═════════════════════════════════════════════════════

  const startResizeH = useCallback((e: React.MouseEvent) => {
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
  }, [previewWidth]);

  const startResizeV = useCallback((e: React.MouseEvent) => {
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
  }, [timelineHeight]);

  // ═════════════════════════════════════════════════════
  // UPLOAD & TRANSCRIBE
  // ═════════════════════════════════════════════════════

  const handleFileUpload = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      setSourceVideoUrl(url);
      setProjectName(file.name.replace(/\.[^.]+$/, ""));
      setWorkflow("processing");

      // Step 1: Uploading
      setProcessingSteps((prev) =>
        prev.map((s) =>
          s.id === "upload" ? { ...s, status: "active" } : s
        )
      );

      // Simulate upload progress
      await new Promise((r) => setTimeout(r, 800));
      setProcessingSteps((prev) =>
        prev.map((s) =>
          s.id === "upload"
            ? { ...s, status: "done" }
            : s.id === "transcribe"
              ? { ...s, status: "active" }
              : s
        )
      );

      // Step 2: Transcribe
      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.segments) {
            setTranscript(data.segments);
          }
          if (data.brollSuggestions) {
            setBrollSuggestions(data.brollSuggestions);
          }
        }
      } catch (err) {
        console.error("Transcribe failed:", err);
      }

      setProcessingSteps((prev) =>
        prev.map((s) =>
          s.id === "transcribe"
            ? { ...s, status: "done" }
            : s.id === "analyze"
              ? { ...s, status: "active" }
              : s
        )
      );

      // Step 3: Analyze (simulated)
      await new Promise((r) => setTimeout(r, 1500));
      setProcessingSteps((prev) =>
        prev.map((s) =>
          s.id === "analyze"
            ? { ...s, status: "done" }
            : s.id === "ready"
              ? { ...s, status: "done" }
              : s
        )
      );

      // Generate default subtitle clips from transcript
      if (transcript.length === 0) {
        // Generate demo segments if transcription returned nothing
        const demoSegments: TranscriptSegment[] = [
          {
            id: "seg-1",
            text: "Welcome to this video",
            start: 0,
            end: 2,
            words: [],
          },
          {
            id: "seg-2",
            text: "Today we are going to talk about AI",
            start: 2.5,
            end: 5,
            words: [],
          },
          {
            id: "seg-3",
            text: "Let's get started",
            start: 5.5,
            end: 7,
            words: [],
          },
        ];
        setTranscript(demoSegments);
      }

      // Build initial timeline clips
      const videoClip: TimelineClip = {
        id: uid("video"),
        trackType: "video",
        trackIndex: 0,
        startTime: 0,
        duration: 30,
        label: file.name,
        src: url,
      };
      const audioClip: TimelineClip = {
        id: uid("audio"),
        trackType: "audio",
        trackIndex: 1,
        startTime: 0,
        duration: 30,
        label: "Original Audio",
        src: url,
      };

      dispatch({ type: "ADD_CLIP", clip: videoClip });
      dispatch({ type: "ADD_CLIP", clip: audioClip });

      // Transition to editor
      await new Promise((r) => setTimeout(r, 600));
      setWorkflow("editor");
    },
    [transcript.length]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleYoutubeSubmit = useCallback(() => {
    if (!youtubeUrl.trim()) return;
    setSourceVideoUrl(youtubeUrl);
    setProjectName("YouTube Import");
    setWorkflow("processing");

    // Simulate processing
    setProcessingSteps((prev) =>
      prev.map((s) =>
        s.id === "upload" ? { ...s, status: "active" } : s
      )
    );
    setTimeout(() => {
      setProcessingSteps((prev) =>
        prev.map((s) => ({ ...s, status: "done" }))
      );
      setTranscript([
        {
          id: "yt-1",
          text: "YouTube video segment",
          start: 0,
          end: 3,
          words: [],
        },
      ]);
      const videoClip: TimelineClip = {
        id: uid("video"),
        trackType: "video",
        trackIndex: 0,
        startTime: 0,
        duration: 30,
        label: "YouTube Import",
      };
      dispatch({ type: "ADD_CLIP", clip: videoClip });
      setWorkflow("editor");
    }, 3000);
  }, [youtubeUrl]);

  // ═════════════════════════════════════════════════════
  // INTEGRATION CALLBACKS
  // ═════════════════════════════════════════════════════

  // SubtitlesEngine → timeline
  const handleStyleSelect = useCallback(
    (style: CaptionStyle) => {
      setCaptionStyle(style);
      // Remove old subtitle clips, recreate from transcript
      const oldSubIds = timeline.clips
        .filter((c) => c.trackType === "subtitle")
        .map((c) => c.id);
      oldSubIds.forEach((id) =>
        dispatch({ type: "REMOVE_CLIP", clipId: id })
      );
      transcript.forEach((seg) => {
        dispatch({
          type: "ADD_CLIP",
          clip: {
            id: uid("sub"),
            trackType: "subtitle",
            trackIndex: 2,
            startTime: seg.start,
            duration: seg.end - seg.start,
            label: seg.text,
            style,
          },
        });
      });
    },
    [transcript, timeline.clips]
  );

  // BrollEngine → timeline
  const handleBrollAdd = useCallback(
    (clip: BrollClip, timestamp: number) => {
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
    },
    []
  );

  // EffectsEngine → timeline
  const handleAddEffect = useCallback((keyframe: EffectKeyframe) => {
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id: uid("fx"),
        trackType: "effect",
        trackIndex: 4,
        startTime: keyframe.time,
        duration: keyframe.duration,
        label: keyframe.type,
        effectType: keyframe.type,
        effectParams: keyframe.params,
      },
    });
  }, []);

  // AudioEngine → timeline
  const handleAddMusicTrack = useCallback((track: MusicTrack) => {
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id: uid("music"),
        trackType: "audio",
        trackIndex: 1,
        startTime: 0,
        duration: track.duration || 30,
        label: `♫ ${track.title}`,
        src: track.previewUrl || track.downloadUrl,
      },
    });
  }, []);

  // ── Export ─────────────────────────────────────────
  const handleExport = useCallback(
    (settings: { resolution: string; format: string; aspectRatio: string }) => {
      setExporting(true);
      setExportProgress(0);

      // Simulate export progress
      const interval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setExporting(false);
            return 100;
          }
          return prev + Math.random() * 8 + 2;
        });
      }, 300);
    },
    []
  );

  // ── Ruler click ────────────────────────────────────
  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x =
        e.clientX -
        rect.left +
        (timelineBodyRef.current?.scrollLeft ?? 0);
      const time = x / pixelsPerSecond;
      dispatch({
        type: "SET_TIME",
        time: Math.max(0, Math.min(time, timeline.duration)),
      });
    },
    [pixelsPerSecond, timeline.duration]
  );

  // ── Track meta ─────────────────────────────────────
  const updateTrackMeta = useCallback(
    (idx: number, update: Partial<typeof trackMetas[0]>) =>
      setTrackMetas((prev) => ({
        ...prev,
        [idx]: { ...prev[idx], ...update },
      })),
    []
  );

  // ═════════════════════════════════════════════════════
  // RENDER: UPLOAD STATE
  // ═════════════════════════════════════════════════════

  if (workflow === "upload") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: BG,
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: `1px solid ${BORDER}`,
            background: "rgba(17,17,19,0.8)",
            backdropFilter: "blur(12px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>
              ◉
            </span>
            <span
              style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}
            >
              Cineflow
            </span>
          </div>
        </header>

        {/* Upload content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 640, width: "100%" }}>
            {/* Mode tabs */}
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 24,
                padding: 4,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
              }}
            >
              {(
                [
                  { id: "single" as UploadMode, label: "📂 Upload Video" },
                  { id: "clone" as UploadMode, label: "🎭 Clone Style" },
                  { id: "youtube" as UploadMode, label: "▶ YouTube URL" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setUploadMode(mode.id)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      uploadMode === mode.id
                        ? "rgba(139,92,246,0.15)"
                        : "transparent",
                    color:
                      uploadMode === mode.id
                        ? ACCENT
                        : "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Single upload */}
            {uploadMode === "single" && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed rgba(139,92,246,0.3)",
                  borderRadius: 20,
                  padding: "64px 32px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: "rgba(139,92,246,0.03)",
                }}
                onDragEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = ACCENT;
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(139,92,246,0.08)";
                }}
                onDragLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(139,92,246,0.3)";
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(139,92,246,0.03)";
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin: "0 auto 20px",
                    borderRadius: 20,
                    background: "rgba(139,92,246,0.1)",
                    border: `1px solid rgba(139,92,246,0.2)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                  }}
                >
                  🎬
                </div>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#fff",
                    margin: "0 0 8px",
                  }}
                >
                  Drag & drop your video here
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    margin: 0,
                  }}
                >
                  or click to browse · MP4, MOV, WebM
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
              </div>
            )}

            {/* Clone style */}
            {uploadMode === "clone" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  onClick={() => refFileInputRef.current?.click()}
                  style={{
                    border: `2px dashed rgba(139,92,246,0.3)`,
                    borderRadius: 16,
                    padding: "32px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "rgba(139,92,246,0.03)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      margin: "0 0 4px",
                    }}
                  >
                    🎭 Upload Reference Video
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      margin: 0,
                    }}
                  >
                    The style to clone
                  </p>
                  <input
                    ref={refFileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setReferenceVideoUrl(URL.createObjectURL(f));
                    }}
                  />
                </div>
                {referenceVideoUrl && (
                  <p style={{ fontSize: 12, color: "#22c55e" }}>
                    ✅ Reference uploaded
                  </p>
                )}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${BORDER}`,
                    borderRadius: 16,
                    padding: "32px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      margin: "0 0 4px",
                    }}
                  >
                    📂 Upload Your Video
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      margin: 0,
                    }}
                  >
                    The video to edit
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </div>
              </div>
            )}

            {/* YouTube URL */}
            {uploadMode === "youtube" && (
              <div
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  padding: 32,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    onKeyDown={(e) => e.key === "Enter" && handleYoutubeSubmit()}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "rgba(255,255,255,0.04)",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={handleYoutubeSubmit}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 10,
                      border: "none",
                      background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Import
                  </button>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    margin: 0,
                  }}
                >
                  Paste a YouTube URL to import and edit
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════
  // RENDER: PROCESSING STATE
  // ═════════════════════════════════════════════════════

  if (workflow === "processing") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          gap: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              borderRadius: 20,
              background: "rgba(139,92,246,0.1)",
              border: `1px solid rgba(139,92,246,0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: "3px solid rgba(139,92,246,0.3)",
                borderTopColor: ACCENT,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
          <h2
            style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}
          >
            Processing your video
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            This may take a moment...
          </p>
        </div>

        {/* Steps */}
        <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          {processingSteps.map((step) => (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: `1px solid ${step.status === "active" ? "rgba(139,92,246,0.3)" : BORDER}`,
                background:
                  step.status === "active"
                    ? "rgba(139,92,246,0.06)"
                    : "rgba(255,255,255,0.02)",
                transition: "all 0.3s",
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  flexShrink: 0,
                  background:
                    step.status === "done"
                      ? "rgba(34,197,94,0.15)"
                      : step.status === "active"
                        ? "rgba(139,92,246,0.15)"
                        : "rgba(255,255,255,0.04)",
                }}
              >
                {step.status === "done" && (
                  <span style={{ color: "#22c55e" }}>✓</span>
                )}
                {step.status === "active" && (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(139,92,246,0.3)",
                      borderTopColor: ACCENT,
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
                {step.status === "pending" && (
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>○</span>
                )}
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
                        : "rgba(255,255,255,0.3)",
                  transition: "color 0.3s",
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════
  // RENDER: EDITOR STATE (main layout)
  // ═════════════════════════════════════════════════════

  const RIGHT_PANEL_TABS: {
    id: RightPanelTab;
    label: string;
    icon: string;
  }[] = [
    { id: "subtitles", label: "Subtitles", icon: "📝" },
    { id: "broll", label: "B-Roll", icon: "🎞️" },
    { id: "effects", label: "Effects", icon: "✨" },
    { id: "audio", label: "Audio", icon: "🎵" },
  ];

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: BG,
        overflow: "hidden",
      }}
    >
      {/* ══════ HEADER ══════ */}
      <header
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(17,17,19,0.85)",
          backdropFilter: "blur(12px)",
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Left: logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>◉</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            Cineflow
          </span>
          <div
            style={{
              width: 1,
              height: 20,
              background: "rgba(255,255,255,0.1)",
              margin: "0 8px",
            }}
          />
          {/* Project name */}
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
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                width: 200,
              }}
            />
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                cursor: "text",
                padding: "4px 8px",
                borderRadius: 6,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "transparent")
              }
            >
              {projectName}
            </span>
          )}
        </div>

        {/* Center: playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => {
              dispatch({ type: "SET_PLAYING", playing: false });
              dispatch({ type: "SET_TIME", time: 0 });
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
            }}
            title="Stop"
          >
            ◼
          </button>
          <button
            onClick={() =>
              dispatch({ type: "SET_PLAYING", playing: !timeline.playing })
            }
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
              boxShadow: timeline.playing
                ? "0 0 16px rgba(239,68,68,0.3)"
                : "0 0 16px rgba(139,92,246,0.3)",
              transition: "all 0.2s",
            }}
            title={timeline.playing ? "Pause" : "Play"}
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
            {formatTime(timeline.currentTime)} /{" "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>
              {formatTime(timeline.duration)}
            </span>
          </span>
        </div>

        {/* Right: export */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={hist.past.length === 0}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "rgba(255,255,255,0.04)",
              color:
                hist.past.length === 0
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.6)",
              cursor: hist.past.length === 0 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
            title="Undo"
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
              color:
                hist.future.length === 0
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.6)",
              cursor: hist.future.length === 0 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
            title="Redo"
          >
            ↪
          </button>
          <button
            onClick={() => setShowExport(true)}
            style={{
              padding: "6px 16px",
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
              transition: "all 0.2s",
            }}
          >
            ⬇ Export
          </button>
        </div>
      </header>

      {/* ══════ MAIN CONTENT AREA ══════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ── TOP AREA: Preview + Right Panel ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* ── PREVIEW PANEL ── */}
          <div
            style={{
              width: `${previewWidth}%`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: 8,
            }}
          >
            <PlaybackPreview
              timeline={timeline}
              onSetTime={(t) => dispatch({ type: "SET_TIME", time: t })}
              onSetPlaying={(p) => dispatch({ type: "SET_PLAYING", playing: p })}
            />
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
              position: "relative",
            }}
          >
            <div
              style={{
                width: 2,
                height: 40,
                borderRadius: 1,
                background: "rgba(255,255,255,0.1)",
                transition: "background 0.2s",
              }}
            />
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
            <div
              style={{
                display: "flex",
                borderBottom: `1px solid ${BORDER}`,
                flexShrink: 0,
                background: "rgba(0,0,0,0.3)",
              }}
            >
              {RIGHT_PANEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    border: "none",
                    borderBottom:
                      activeTab === tab.id
                        ? `2px solid ${ACCENT}`
                        : "2px solid transparent",
                    background:
                      activeTab === tab.id
                        ? "rgba(139,92,246,0.05)"
                        : "transparent",
                    color:
                      activeTab === tab.id
                        ? "#fff"
                        : "rgba(255,255,255,0.45)",
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
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {activeTab === "subtitles" && (
                <SubtitlesEngine
                  onStyleSelect={handleStyleSelect}
                  onPositionChange={() => {}}
                  onTranscriptEdit={() => {}}
                  initialStyle={captionStyle || undefined}
                />
              )}

              {activeTab === "broll" && (
                <BrollEngine
                  transcript={transcript}
                  suggestions={brollSuggestions}
                  onAddClip={handleBrollAdd}
                />
              )}

              {activeTab === "effects" && (
                <EffectsEngine
                  selectedClipId={
                    selectedClipIds.size === 1
                      ? Array.from(selectedClipIds)[0]
                      : undefined
                  }
                  currentTime={timeline.currentTime}
                  totalDuration={timeline.duration}
                  onAddEffect={handleAddEffect}
                />
              )}

              {activeTab === "audio" && (
                <AudioEngine
                  audioUrl={sourceVideoUrl}
                  transcript={
                    transcript.map((s) => s.text).join(" ")
                  }
                  onSettingsChange={setAudioSettings}
                  onAddTrack={handleAddMusicTrack}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── VERTICAL RESIZE HANDLE (timeline top) ── */}
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
            position: "relative",
          }}
        >
          <div
            style={{
              width: 40,
              height: 2,
              borderRadius: 1,
              background: "rgba(255,255,255,0.1)",
              transition: "background 0.2s",
            }}
          />
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
            {/* Zoom */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() =>
                  dispatch({ type: "SET_ZOOM", zoom: timeline.zoom - 0.2 })
                }
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
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "monospace",
                  width: 36,
                  textAlign: "center",
                }}
              >
                {Math.round(timeline.zoom * 100)}%
              </span>
              <button
                onClick={() =>
                  dispatch({ type: "SET_ZOOM", zoom: timeline.zoom + 0.2 })
                }
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

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Split */}
              <button
                onClick={() => {
                  selectedClipIds.forEach((id) =>
                    dispatch({
                      type: "SPLIT_CLIP",
                      clipId: id,
                      splitAt: timeline.currentTime,
                    })
                  );
                }}
                disabled={selectedClipIds.size === 0}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: "transparent",
                  color:
                    selectedClipIds.size === 0
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor:
                    selectedClipIds.size === 0 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                ✂ Split
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  selectedClipIds.forEach((id) =>
                    dispatch({ type: "REMOVE_CLIP", clipId: id })
                  );
                  setSelectedClipIds(new Set());
                }}
                disabled={selectedClipIds.size === 0}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: "transparent",
                  color:
                    selectedClipIds.size === 0
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(239,68,68,0.7)",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor:
                    selectedClipIds.size === 0 ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                🗑 Delete
              </button>

              <div
                style={{
                  width: 1,
                  height: 16,
                  background: "rgba(255,255,255,0.06)",
                  margin: "0 4px",
                }}
              />

              {/* Snap */}
              <button
                onClick={() => setSnapEnabled((v) => !v)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: snapEnabled
                    ? "rgba(139,92,246,0.15)"
                    : "transparent",
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
            style={{
              flex: 1,
              overflowX: "auto",
              overflowY: "auto",
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).dataset.timeline) {
                setSelectedClipIds(new Set());
              }
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
              <div
                style={{
                  position: "absolute",
                  left: 160,
                  right: 0,
                  height: "100%",
                }}
              >
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
                    <div
                      style={{
                        width: 1,
                        flex: 1,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                  </div>
                ))}
                {/* Playhead marker */}
                <div
                  style={{
                    position: "absolute",
                    left: timeline.currentTime * pixelsPerSecond - 5,
                    top: 0,
                    zIndex: 40,
                  }}
                >
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="#ef4444">
                    <polygon points="0,0 10,0 5,10" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Tracks */}
            <div
              style={{
                position: "relative",
                width: totalWidth + 160,
              }}
              data-timeline="true"
            >
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
                  onToggleMute={() =>
                    updateTrackMeta(idx, { muted: !trackMetas[idx]?.muted })
                  }
                  onToggleSolo={() =>
                    updateTrackMeta(idx, { solo: !trackMetas[idx]?.solo })
                  }
                  onToggleLock={() =>
                    updateTrackMeta(idx, { locked: !trackMetas[idx]?.locked })
                  }
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
                  boxShadow:
                    "0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)",
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
            ].map(([key, label]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
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
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ EXPORT MODAL ══════ */}
      {showExport && (
        <ExportModal
          onClose={() => {
            setShowExport(false);
            setExporting(false);
            setExportProgress(0);
          }}
          onExport={handleExport}
          exporting={exporting}
          exportProgress={exportProgress}
        />
      )}
    </div>
  );
}
