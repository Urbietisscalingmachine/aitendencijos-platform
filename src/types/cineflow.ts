/* ═══════════════════════════════════════════════════════════
   CINEFLOW — Shared Types
   All sub-agents import from here
   ═══════════════════════════════════════════════════════════ */

// ─── Captions ───────────────────────────────────────────
export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface CaptionStyle {
  id: string;
  name: string;
  category: "classic" | "creator" | "animated" | "stylized" | "social" | "special";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  highlightColor?: string;
  position: "top" | "center" | "bottom";
  animation: "none" | "fade" | "pop" | "bounce" | "typewriter" | "karaoke" | "wave" | "word-fade" | "slide";
  textTransform?: "none" | "uppercase" | "lowercase";
  textShadow?: string;
  stroke?: string;
  customCSS?: React.CSSProperties;
  preview: string; // example text for preview
}

// ─── Timeline ───────────────────────────────────────────
export type TrackType = "video" | "audio" | "subtitle" | "broll" | "effect";

export interface TimelineClip {
  id: string;
  trackType: TrackType;
  trackIndex: number;
  startTime: number; // position on timeline (seconds)
  duration: number;
  sourceStart?: number; // trim start in source
  sourceEnd?: number;
  src?: string; // url or blob
  label?: string;
  words?: { word: string; start: number; end: number }[]; // word-level timestamps for subtitle clips
  style?: CaptionStyle;
  effectType?: EffectType;
  effectParams?: Record<string, unknown>;
}

export interface TimelineState {
  clips: TimelineClip[];
  tracks: TrackType[];
  duration: number; // total duration
  currentTime: number;
  zoom: number; // timeline zoom level
  playing: boolean;
}

export type TimelineAction =
  | { type: "ADD_CLIP"; clip: TimelineClip }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "MOVE_CLIP"; clipId: string; startTime: number; trackIndex: number }
  | { type: "TRIM_CLIP"; clipId: string; startTime: number; duration: number }
  | { type: "SPLIT_CLIP"; clipId: string; splitAt: number }
  | { type: "UPDATE_CLIP"; clipId: string; changes: Partial<TimelineClip> }
  | { type: "SET_TIME"; time: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "UNDO" }
  | { type: "REDO" };

// ─── B-Roll ─────────────────────────────────────────────
export interface BrollSuggestion {
  id: string;
  timestamp: number; // when to insert
  duration: number;
  keyword: string;
  cinematicPrompt: string; // for Kling
  pexelsQuery: string;
  type: "stock" | "ai-generated" | "screen-recording";
  shotType: "close-up" | "aerial" | "tracking" | "dolly" | "macro" | "wide";
  mood: "epic" | "intimate" | "energetic" | "dark" | "calm" | "futuristic";
}

export interface BrollClip {
  id: string;
  src: string;
  thumbnail: string;
  duration: number;
  source: "pexels" | "kling" | "upload";
  overlayMode: "fullscreen" | "pip" | "split";
}

// ─── Effects ────────────────────────────────────────────
export type EffectType =
  | "zoom-in" | "zoom-out" | "ken-burns"
  | "zoom-shake" | "zoom-pulse"
  | "color-warm" | "color-cold" | "color-cinematic" | "color-vintage"
  | "color-highcontrast" | "color-bw"
  | "blur" | "vignette" | "grain" | "sharpen"
  | "text-overlay" | "lower-third" | "title-animated"
  | "emoji" | "sticker"
  | "transition-cut" | "transition-crossfade" | "transition-slide"
  | "transition-zoom" | "transition-glitch";

export interface EffectKeyframe {
  time: number;
  type: EffectType;
  params: Record<string, unknown>;
  duration: number;
}

// ─── Audio ──────────────────────────────────────────────
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  duration: number;
  previewUrl: string;
  downloadUrl: string;
  source: "pixabay" | "freesound" | "upload";
}

export interface AudioSettings {
  videoVolume: number; // 0-1
  musicVolume: number;
  duckingLevel: number; // how much music ducks when speech
  fadeInDuration: number;
  fadeOutDuration: number;
  silenceThreshold: number; // dB
  silenceAction: "cut" | "speedup" | "none";
  silenceSpeedMultiplier: number; // 2x-6x for speedup
}

export interface SilenceSegment {
  start: number;
  end: number;
  duration: number;
}

// ─── Style Clone (Reference) ────────────────────────────
export interface StyleDNA {
  captions: {
    font: string;
    size: number;
    color: string;
    highlightColor: string;
    position: string;
    animation: string;
  };
  broll: {
    frequency: number; // seconds between b-roll
    avgDuration: number;
    type: string;
    style: string;
  };
  zoom: {
    onEmphasis: boolean;
    scale: number;
    speed: "slow" | "fast" | "instant";
    frequency: number;
  };
  music: {
    genre: string;
    volume: number;
    duckingLevel: number;
  };
  colorGrading: string;
  pacing: {
    cutsPerMinute: number;
    avgClipDuration: number;
  };
  transitions: string;
}

// ─── Project ────────────────────────────────────────────
export interface CineflowProject {
  id: string;
  name: string;
  createdAt: string;
  sourceVideo: string; // url
  transcript: TranscriptSegment[];
  timeline: TimelineState;
  captionStyle: CaptionStyle;
  audioSettings: AudioSettings;
  styleDNA?: StyleDNA; // if cloned from reference
  status: "idle" | "uploading" | "transcribing" | "analyzing" | "rendering" | "done" | "error";
}
