"use client";

import React, {
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useState,
  useMemo,
} from "react";
import type {
  TimelineState,
  TimelineClip,
  TimelineAction,
  TrackType,
} from "@/types/cineflow";
import TimelineTrack, { TRACK_CONFIG } from "./TimelineTrack";
import PlaybackPreview from "./PlaybackPreview";

/* ═══════════════════════════════════════════════════════════
   TIMELINE EDITOR — Main orchestrator
   Multi-track NLE-style timeline with undo/redo, snap,
   zoom, minimap, keyboard shortcuts, clip manipulation
   ═══════════════════════════════════════════════════════════ */

// ── Constants ───────────────────────────────────────────
const TRACKS: TrackType[] = ["video", "audio", "subtitle", "broll", "effect"];
const BASE_PPS = 60; // pixels per second at zoom=1
const SNAP_THRESHOLD_PX = 6;
const MAX_HISTORY = 50;
const FRAME_DURATION = 1 / 30; // 30fps

// ── Initial state ───────────────────────────────────────
const INITIAL_STATE: TimelineState = {
  clips: [
    // Demo clips so the timeline isn't empty
    { id: "v1", trackType: "video", trackIndex: 0, startTime: 0, duration: 8, label: "Main Take" },
    { id: "v2", trackType: "video", trackIndex: 0, startTime: 8.5, duration: 5, label: "Close-up" },
    { id: "a1", trackType: "audio", trackIndex: 1, startTime: 0, duration: 12, label: "Voiceover" },
    { id: "s1", trackType: "subtitle", trackIndex: 2, startTime: 0.5, duration: 3, label: "Sveiki, aš esu Žygis" },
    { id: "s2", trackType: "subtitle", trackIndex: 2, startTime: 4, duration: 2.5, label: "Šiandien kalbėsime apie AI" },
    { id: "s3", trackType: "subtitle", trackIndex: 2, startTime: 7, duration: 3, label: "Pradėkime nuo pradžių..." },
    { id: "b1", trackType: "broll", trackIndex: 3, startTime: 4, duration: 3, label: "AI visualization" },
    { id: "e1", trackType: "effect", trackIndex: 4, startTime: 0, duration: 1.5, label: "zoom-in", effectType: "zoom-in" },
    { id: "e2", trackType: "effect", trackIndex: 4, startTime: 8, duration: 0.5, label: "crossfade", effectType: "transition-crossfade" },
  ],
  tracks: TRACKS,
  duration: 30,
  currentTime: 0,
  zoom: 1,
  playing: false,
};

// ── Reducer ─────────────────────────────────────────────
function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "ADD_CLIP":
      return { ...state, clips: [...state.clips, action.clip] };

    case "REMOVE_CLIP":
      return { ...state, clips: state.clips.filter((c) => c.id !== action.clipId) };

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
      };
      return {
        ...state,
        clips: state.clips.map((c) => (c.id === clip.id ? leftClip : c)).concat(rightClip),
      };
    }

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

// ── Undo/redo wrapper ───────────────────────────────────
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

  // Non-temporal actions don't create history entries
  if (action.type === "SET_TIME" || action.type === "SET_PLAYING" || action.type === "SET_ZOOM") {
    return { ...hist, present: timelineReducer(hist.present, action) };
  }

  // Mutating action → push to history
  const newPresent = timelineReducer(hist.present, action);
  return {
    past: [...hist.past, hist.present].slice(-MAX_HISTORY),
    present: newPresent,
    future: [], // clear redo on new action
  };
}

// ── Track state ─────────────────────────────────────────
interface TrackMeta {
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
}

const defaultTrackMeta = (): TrackMeta => ({
  muted: false,
  solo: false,
  locked: false,
  volume: 0.8,
});

// ── TimelineEditor ──────────────────────────────────────
export default function TimelineEditor() {
  // ── State ──
  const [hist, dispatch] = useReducer(historyReducer, {
    past: [],
    present: INITIAL_STATE,
    future: [],
  });
  const timeline = hist.present;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackMetas, setTrackMetas] = useState<Record<number, TrackMeta>>(() => {
    const m: Record<number, TrackMeta> = {};
    TRACKS.forEach((_, i) => (m[i] = defaultTrackMeta()));
    return m;
  });
  const [snapEnabled, setSnapEnabled] = useState(true);

  // ── Refs ──
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{
    clipId: string;
    edge: "left" | "right" | "body";
    startX: number;
    origStart: number;
    origDuration: number;
    origTrackIndex: number;
  } | null>(null);

  // ── Derived ──
  const pixelsPerSecond = BASE_PPS * timeline.zoom;
  const totalWidth = timeline.duration * pixelsPerSecond;

  // ── Playback timer ──
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

  // Stop playing at end
  useEffect(() => {
    if (timeline.playing && timeline.currentTime >= timeline.duration) {
      dispatch({ type: "SET_PLAYING", playing: false });
      dispatch({ type: "SET_TIME", time: 0 });
    }
  }, [timeline.currentTime, timeline.duration, timeline.playing]);

  // ── Snap helper ──
  const snapTime = useCallback(
    (time: number, excludeClipId?: string): number => {
      if (!snapEnabled) return time;
      const edges: number[] = [0];
      timeline.clips.forEach((c) => {
        if (c.id === excludeClipId) return;
        edges.push(c.startTime, c.startTime + c.duration);
      });
      edges.push(timeline.currentTime); // snap to playhead too
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

  // ── Clip mouse interactions (drag, resize) ──
  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, edge: "left" | "right" | "body") => {
      e.preventDefault();

      // Selection
      if (e.shiftKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.has(clip.id) ? next.delete(clip.id) : next.add(clip.id);
          return next;
        });
      } else if (!selectedIds.has(clip.id)) {
        setSelectedIds(new Set([clip.id]));
      }

      dragRef.current = {
        clipId: clip.id,
        edge,
        startX: e.clientX,
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

          // Calculate track index from Y delta
          const dy = ev.clientY - e.clientY;
          const trackDelta = Math.round(dy / 60);
          const newTrackIdx = Math.max(0, Math.min(TRACKS.length - 1, dragRef.current.origTrackIndex + trackDelta));

          dispatch({
            type: "MOVE_CLIP",
            clipId: dragRef.current.clipId,
            startTime: Math.max(0, snapped),
            trackIndex: newTrackIdx,
          });
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
    [selectedIds, pixelsPerSecond, snapTime]
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
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
        case (e.code === "Delete" || e.code === "Backspace") && selectedIds.size > 0: {
          e.preventDefault();
          selectedIds.forEach((id) => dispatch({ type: "REMOVE_CLIP", clipId: id }));
          setSelectedIds(new Set());
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
          // Split selected clips at playhead
          selectedIds.forEach((id) => {
            dispatch({ type: "SPLIT_CLIP", clipId: id, splitAt: timeline.currentTime });
          });
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [timeline.playing, timeline.currentTime, selectedIds]);

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

  // ── Ruler click → set time ──
  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (timelineBodyRef.current?.scrollLeft ?? 0);
      const time = x / pixelsPerSecond;
      dispatch({ type: "SET_TIME", time: Math.max(0, Math.min(time, timeline.duration)) });
    },
    [pixelsPerSecond, timeline.duration]
  );

  // ── Split at playhead ──
  const handleSplit = useCallback(() => {
    selectedIds.forEach((id) => {
      dispatch({ type: "SPLIT_CLIP", clipId: id, splitAt: timeline.currentTime });
    });
  }, [selectedIds, timeline.currentTime]);

  // ── Delete selected ──
  const handleDelete = useCallback(() => {
    selectedIds.forEach((id) => dispatch({ type: "REMOVE_CLIP", clipId: id }));
    setSelectedIds(new Set());
  }, [selectedIds]);

  // ── Track meta helpers ──
  const updateTrackMeta = useCallback(
    (idx: number, update: Partial<TrackMeta>) =>
      setTrackMetas((prev) => ({ ...prev, [idx]: { ...prev[idx], ...update } })),
    []
  );

  // ── Ruler marks ──
  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; major: boolean }[] = [];
    // Determine interval based on zoom
    let interval = 5;
    if (pixelsPerSecond > 100) interval = 1;
    if (pixelsPerSecond > 200) interval = 0.5;
    if (pixelsPerSecond < 30) interval = 10;

    for (let t = 0; t <= timeline.duration; t += interval) {
      const isMajor = t % (interval >= 5 ? interval : 5) === 0 || interval < 5;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const label = `${m}:${s.toString().padStart(2, "0")}`;
      marks.push({ time: t, label, major: isMajor });
    }
    return marks;
  }, [timeline.duration, pixelsPerSecond]);

  // ── Minimap ──
  const minimapWidth = 280;
  const minimapScale = timeline.duration > 0 ? minimapWidth / timeline.duration : 1;
  const minimapViewWidth = timelineBodyRef.current
    ? (timelineBodyRef.current.clientWidth / totalWidth) * minimapWidth
    : minimapWidth;
  const minimapViewLeft = timelineBodyRef.current
    ? (timelineBodyRef.current.scrollLeft / totalWidth) * minimapWidth
    : 0;

  // ── Clips per track ──
  const clipsPerTrack = useMemo(() => {
    const map: Record<number, TimelineClip[]> = {};
    TRACKS.forEach((_, i) => (map[i] = []));
    timeline.clips.forEach((c) => {
      const idx = c.trackIndex;
      if (map[idx]) map[idx].push(c);
    });
    return map;
  }, [timeline.clips]);

  return (
    <div className="flex flex-col w-full h-full" style={{ backgroundColor: "#09090b", color: "#fff" }}>
      {/* ══════ PREVIEW ══════ */}
      <div className="px-4 pt-4 pb-2">
        <PlaybackPreview
          timeline={timeline}
          onSetTime={(t) => dispatch({ type: "SET_TIME", time: t })}
          onSetPlaying={(p) => dispatch({ type: "SET_PLAYING", playing: p })}
        />
      </div>

      {/* ══════ TOOLBAR ══════ */}
      <div
        className="flex items-center justify-between px-4 py-2 mx-4 mb-1 rounded-xl"
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left: zoom */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: timeline.zoom - 0.2 })}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold"
            title="Zoom Out"
          >
            −
          </button>
          <div className="w-16 text-center">
            <span className="text-[10px] text-white/50 font-mono">
              {Math.round(timeline.zoom * 100)}%
            </span>
          </div>
          <button
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: timeline.zoom + 0.2 })}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold"
            title="Zoom In"
          >
            +
          </button>
        </div>

        {/* Center: actions */}
        <div className="flex items-center gap-1">
          {/* Undo */}
          <button
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={hist.past.length === 0}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors
                       disabled:opacity-20 text-white/50 hover:text-white hover:bg-white/5"
            title="Undo (Ctrl+Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          {/* Redo */}
          <button
            onClick={() => dispatch({ type: "REDO" })}
            disabled={hist.future.length === 0}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors
                       disabled:opacity-20 text-white/50 hover:text-white hover:bg-white/5"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
            </svg>
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Split */}
          <button
            onClick={handleSplit}
            disabled={selectedIds.size === 0}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                       disabled:opacity-20 text-white/60 hover:text-white hover:bg-white/5 flex items-center gap-1"
            title="Split at Playhead (S)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="2" x2="12" y2="22" />
              <polyline points="8 6 12 2 16 6" />
              <polyline points="8 18 12 22 16 18" />
            </svg>
            Split
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                       disabled:opacity-20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1"
            title="Delete (Del)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete
          </button>
        </div>

        {/* Right: snap toggle + minimap */}
        <div className="flex items-center gap-3">
          {/* Snap toggle */}
          <button
            onClick={() => setSnapEnabled((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: snapEnabled ? "rgba(139,92,246,0.15)" : "transparent",
              color: snapEnabled ? "#A78BFA" : "rgba(255,255,255,0.3)",
            }}
            title="Snap/Magnet"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 15V9a6 6 0 1 1 12 0v6" />
              <line x1="6" y1="15" x2="6" y2="19" />
              <line x1="18" y1="15" x2="18" y2="19" />
            </svg>
            Snap
          </button>

          {/* Minimap */}
          <div
            className="relative rounded-md overflow-hidden"
            style={{
              width: minimapWidth,
              height: 24,
              backgroundColor: "#1a1a2e",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Clip indicators */}
            {timeline.clips.map((c) => {
              const cfg = TRACK_CONFIG[c.trackType];
              const trackRow = c.trackIndex;
              return (
                <div
                  key={c.id}
                  className="absolute rounded-[2px]"
                  style={{
                    left: c.startTime * minimapScale,
                    width: Math.max(2, c.duration * minimapScale),
                    top: 2 + trackRow * 4,
                    height: 3,
                    backgroundColor: cfg.color,
                    opacity: 0.7,
                  }}
                />
              );
            })}
            {/* Viewport indicator */}
            <div
              className="absolute top-0 bottom-0 border rounded-sm pointer-events-none"
              style={{
                left: minimapViewLeft,
                width: Math.max(8, minimapViewWidth),
                borderColor: "rgba(255,255,255,0.25)",
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            />
            {/* Playhead on minimap */}
            <div
              className="absolute top-0 bottom-0 w-[1px] pointer-events-none"
              style={{
                left: timeline.currentTime * minimapScale,
                backgroundColor: "#ef4444",
              }}
            />
          </div>
        </div>
      </div>

      {/* ══════ TIMELINE AREA ══════ */}
      <div className="flex-1 flex flex-col mx-4 mb-4 rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "#0d0d15",
        }}
      >
        {/* Ruler + tracks share horizontal scroll */}
        <div
          ref={timelineBodyRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          style={{ scrollbarColor: "#2a2a3e #0d0d15" }}
          onClick={(e) => {
            // Deselect if clicking empty space
            if ((e.target as HTMLElement).dataset.timeline) {
              setSelectedIds(new Set());
            }
          }}
        >
          {/* ── Ruler ── */}
          <div
            className="sticky top-0 z-30 h-7 flex-shrink-0 cursor-pointer"
            style={{
              width: totalWidth + 180, // include track header
              backgroundColor: "#0a0a14",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={handleRulerClick}
          >
            {/* Offset for track header */}
            <div className="absolute left-[180px] right-0 h-full">
              {rulerMarks.map((mark) => (
                <div
                  key={mark.time}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: mark.time * pixelsPerSecond }}
                >
                  <span className="text-[9px] text-white/30 font-mono mt-0.5 select-none">
                    {mark.label}
                  </span>
                  <div
                    className="w-px flex-1"
                    style={{
                      backgroundColor: mark.major ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                    }}
                  />
                </div>
              ))}

              {/* Playhead marker on ruler */}
              <div
                className="absolute top-0 z-40"
                style={{ left: timeline.currentTime * pixelsPerSecond - 5 }}
              >
                <svg width="10" height="12" viewBox="0 0 10 12" fill="#ef4444">
                  <polygon points="0,0 10,0 5,10" />
                </svg>
              </div>
            </div>
          </div>

          {/* ── Tracks ── */}
          <div className="relative" style={{ width: totalWidth + 180 }} data-timeline="true">
            {TRACKS.map((trackType, idx) => (
              <TimelineTrack
                key={trackType}
                trackType={trackType}
                trackIndex={idx}
                clips={clipsPerTrack[idx] || []}
                zoom={timeline.zoom}
                pixelsPerSecond={pixelsPerSecond}
                selectedClipIds={selectedIds}
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

            {/* ── Playhead line ── */}
            <div
              className="absolute top-0 bottom-0 w-[2px] z-40 pointer-events-none"
              style={{
                left: 180 + timeline.currentTime * pixelsPerSecond,
                backgroundColor: "#ef4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)",
              }}
            >
              {/* Glow dot at bottom */}
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                style={{
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 6px rgba(239,68,68,0.8)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════ KEYBOARD HINTS ══════ */}
      <div
        className="flex items-center justify-center gap-4 px-4 pb-3"
        style={{ opacity: 0.3 }}
      >
        {[
          ["Space", "Play/Pause"],
          ["← →", "Frame Step"],
          ["S", "Split"],
          ["Del", "Remove"],
          ["⌘Z", "Undo"],
          ["⌘⇧Z", "Redo"],
          ["Shift+Click", "Multi-select"],
          ["⌘+Scroll", "Zoom"],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-white/40">
              {key}
            </kbd>
            <span className="text-[9px] text-white/30">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
