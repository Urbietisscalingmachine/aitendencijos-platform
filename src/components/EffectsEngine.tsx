"use client";
/* ═══════════════════════════════════════════════════════════
   CINEFLOW — Effects Engine
   Main effects component with 6 tabs:
   Zoom | Color | Filters | Text | Emoji | Transitions
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useMemo, useRef } from "react";
import type { EffectType, EffectKeyframe } from "@/types/cineflow";

// ─── Constants ──────────────────────────────────────────

const ACCENT = "#8B5CF6";
const BG = "#09090b";
const SURFACE = "rgba(255,255,255,0.04)";
const SURFACE_HOVER = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#f5f5f5";
const TEXT_SECONDARY = "#a1a1aa";
const TEXT_MUTED = "#71717a";

type TabId = "zoom" | "color" | "filters" | "text" | "emoji" | "transitions";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "zoom", label: "Zoom", icon: "🔍" },
  { id: "color", label: "Color", icon: "🎨" },
  { id: "filters", label: "Filters", icon: "✨" },
  { id: "text", label: "Text", icon: "𝐓" },
  { id: "emoji", label: "Emoji", icon: "😀" },
  { id: "transitions", label: "Transitions", icon: "⚡" },
];

// ─── Zoom Presets ───────────────────────────────────────

interface ZoomPreset {
  id: string;
  label: string;
  description: string;
  effectType: EffectType;
  icon: string;
  scaleRange: [number, number];
  speed: "slow" | "medium" | "fast";
}

const ZOOM_PRESETS: ZoomPreset[] = [
  {
    id: "ken-burns",
    label: "Ken Burns",
    description: "Slow smooth zoom 0.5x→1.5x",
    effectType: "ken-burns",
    icon: "🎬",
    scaleRange: [0.5, 1.5],
    speed: "slow",
  },
  {
    id: "quick-emphasis",
    label: "Quick Emphasis",
    description: "Snap zoom 1.0→1.3→1.0 in 0.5s",
    effectType: "zoom-in",
    icon: "⚡",
    scaleRange: [1.0, 1.3],
    speed: "fast",
  },
  {
    id: "zoom-shake",
    label: "Zoom + Shake",
    description: "Dramatic zoom with camera shake",
    effectType: "zoom-shake",
    icon: "📳",
    scaleRange: [1.0, 1.4],
    speed: "fast",
  },
  {
    id: "zoom-pulse",
    label: "Zoom Pulse",
    description: "Rhythmic zoom in/out",
    effectType: "zoom-pulse",
    icon: "💫",
    scaleRange: [1.0, 1.15],
    speed: "medium",
  },
];

// ─── Color Presets ──────────────────────────────────────

interface ColorPreset {
  id: string;
  label: string;
  effectType: EffectType | "original";
  cssFilter: string;
  thumbnail: string; // gradient for preview
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "original",
    label: "Original",
    effectType: "original",
    cssFilter: "none",
    thumbnail: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: "warm",
    label: "Warm",
    effectType: "color-warm",
    cssFilter: "sepia(0.2) saturate(1.3) hue-rotate(-10deg)",
    thumbnail: "linear-gradient(135deg, #f5af19 0%, #f12711 100%)",
  },
  {
    id: "cold",
    label: "Cold",
    effectType: "color-cold",
    cssFilter: "saturate(0.8) hue-rotate(180deg) brightness(1.1)",
    thumbnail: "linear-gradient(135deg, #667eea 0%, #00d2ff 100%)",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    effectType: "color-cinematic",
    cssFilter: "contrast(1.2) saturate(0.85) sepia(0.05) hue-rotate(-15deg)",
    thumbnail: "linear-gradient(135deg, #0c3547 0%, #a2785c 100%)",
  },
  {
    id: "vintage",
    label: "Vintage",
    effectType: "color-vintage",
    cssFilter: "sepia(0.4) contrast(0.9) brightness(0.95)",
    thumbnail: "linear-gradient(135deg, #d4a574 0%, #8b6914 100%)",
  },
  {
    id: "highcontrast",
    label: "High Contrast",
    effectType: "color-highcontrast",
    cssFilter: "contrast(1.5) saturate(1.2)",
    thumbnail: "linear-gradient(135deg, #000 0%, #fff 100%)",
  },
  {
    id: "bw",
    label: "B&W",
    effectType: "color-bw",
    cssFilter: "grayscale(1)",
    thumbnail: "linear-gradient(135deg, #2c3e50 0%, #bdc3c7 100%)",
  },
  {
    id: "moody",
    label: "Moody",
    effectType: "color-bw", // closest mapped type
    cssFilter: "brightness(0.85) contrast(1.3) saturate(0.7)",
    thumbnail: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
];

// ─── Filter Presets ─────────────────────────────────────

interface FilterDef {
  id: string;
  label: string;
  icon: string;
  effectType: EffectType;
  description: string;
  defaultIntensity: number;
  min: number;
  max: number;
  unit: string;
}

const FILTER_DEFS: FilterDef[] = [
  {
    id: "blur",
    label: "Gaussian Blur",
    icon: "🌫️",
    effectType: "blur",
    description: "Adjustable gaussian blur",
    defaultIntensity: 4,
    min: 0,
    max: 20,
    unit: "px",
  },
  {
    id: "vignette",
    label: "Vignette",
    icon: "🔲",
    effectType: "vignette",
    description: "Dark edges",
    defaultIntensity: 50,
    min: 0,
    max: 100,
    unit: "%",
  },
  {
    id: "grain",
    label: "Film Grain",
    icon: "📺",
    effectType: "grain",
    description: "Noise overlay",
    defaultIntensity: 30,
    min: 0,
    max: 100,
    unit: "%",
  },
  {
    id: "sharpen",
    label: "Sharpen",
    icon: "🔪",
    effectType: "sharpen",
    description: "Unsharp mask",
    defaultIntensity: 50,
    min: 0,
    max: 100,
    unit: "%",
  },
  {
    id: "glitch",
    label: "Glitch",
    icon: "📡",
    effectType: "sharpen", // closest mapped type
    description: "RGB split + noise",
    defaultIntensity: 40,
    min: 0,
    max: 100,
    unit: "%",
  },
];

// ─── Text / Fonts ───────────────────────────────────────

const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Playfair Display",
  "Bebas Neue",
  "Raleway",
  "Space Grotesk",
  "Permanent Marker",
] as const;

type TextAnimation = "none" | "fade-in" | "slide-up" | "typewriter" | "bounce";

interface TextOverlay {
  id: string;
  text: string;
  font: string;
  size: number;
  color: string;
  x: number;
  y: number;
  animation: TextAnimation;
  startTime: number;
  duration: number;
  isLowerThird: boolean;
  subtitle?: string; // for lower-third
}

// ─── Emoji ──────────────────────────────────────────────

const POPULAR_EMOJI = [
  "😂","❤️","🔥","👍","😍","🎉","💯","✨","😎","🥳",
  "🤣","😊","💪","🙌","👏","🤔","😱","😢","🥺","😤",
  "💀","🤯","😈","👀","🫡","🤝","✅","❌","⭐","🌟",
  "🎯","🚀","💡","🎬","🎥","📸","🎤","🎵","🎶","🔊",
  "💥","⚡","🔴","🟢","🔵","🟡","⬛","⬜","🟣","🟠",
  "😜","🤩","😇","🥶","🤮","💩","👻","🤖","👽","🦄",
  "🌈","☀️","🌙","⭕","💫","🫶","🤌","👆","👇","👉",
  "👈","🖕","✌️","🤞","🫰","💅","👑","🎭","🎪","🎨",
  "📱","💻","🖥️","📊","📈","🔑","🔒","💎","🏆","🥇",
  "🍕","🍔","☕","🍺","🥂","🎂","🍰","🌮","🍿","🧋",
];

type EmojiAnimation = "bounce" | "rotate" | "fade" | "pop" | "float";

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  animation: EmojiAnimation;
  startTime: number;
  duration: number;
}

// ─── Transitions ────────────────────────────────────────

interface TransitionDef {
  id: string;
  label: string;
  icon: string;
  effectType: EffectType;
  description: string;
  previewGradient: string;
}

const TRANSITION_DEFS: TransitionDef[] = [
  {
    id: "cut",
    label: "Cut",
    icon: "✂️",
    effectType: "transition-cut",
    description: "Instant cut (default)",
    previewGradient: "linear-gradient(90deg, #333 49.5%, transparent 49.5%, transparent 50.5%, #555 50.5%)",
  },
  {
    id: "crossfade",
    label: "Crossfade",
    icon: "🌅",
    effectType: "transition-crossfade",
    description: "Opacity blend",
    previewGradient: "linear-gradient(90deg, #6366f1, transparent, #a855f7)",
  },
  {
    id: "slide",
    label: "Slide L/R",
    icon: "➡️",
    effectType: "transition-slide",
    description: "Slide left or right",
    previewGradient: "linear-gradient(90deg, #3b82f6 0%, #3b82f6 45%, #8b5cf6 55%, #8b5cf6 100%)",
  },
  {
    id: "zoom-transition",
    label: "Zoom",
    icon: "🔎",
    effectType: "transition-zoom",
    description: "Zoom in → zoom out",
    previewGradient: "radial-gradient(circle, #8b5cf6, #1e1b4b)",
  },
  {
    id: "glitch-transition",
    label: "Glitch",
    icon: "📡",
    effectType: "transition-glitch",
    description: "RGB split + noise + flash",
    previewGradient: "linear-gradient(90deg, #ef4444, #22c55e, #3b82f6)",
  },
  {
    id: "wipe",
    label: "Wipe",
    icon: "🧹",
    effectType: "transition-slide", // closest mapped
    description: "Horizontal/vertical wipe",
    previewGradient: "linear-gradient(90deg, #8b5cf6 50%, transparent 50%)",
  },
];

// ─── Exported Callbacks ─────────────────────────────────

export interface EffectsEngineProps {
  /** currently selected clip id */
  selectedClipId?: string;
  /** current playback time in seconds */
  currentTime?: number;
  /** total clip/project duration in seconds */
  totalDuration?: number;
  /** called when an effect keyframe is added */
  onAddEffect?: (keyframe: EffectKeyframe) => void;
  /** called when the color grading CSS filter changes */
  onColorFilterChange?: (cssFilter: string) => void;
  /** called when a text overlay is created or updated */
  onTextOverlay?: (overlay: TextOverlay) => void;
  /** called when an emoji overlay is created or updated */
  onEmojiOverlay?: (overlay: EmojiOverlay) => void;
  /** called when a transition is selected */
  onTransitionSelect?: (type: EffectType, duration: number, applyAll: boolean) => void;
}

// ─── Utility: CSS helper ────────────────────────────────

const glass = (opacity = 0.06): React.CSSProperties => ({
  background: `rgba(255,255,255,${opacity})`,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
});

const btnBase: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: TEXT_PRIMARY,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
};

// ─── Reusable Slider ────────────────────────────────────

function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  unit = "",
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 12,
          color: TEXT_SECONDARY,
        }}
      >
        <span>{label}</span>
        <span style={{ color: ACCENT, fontWeight: 600 }}>
          {typeof step === "number" && step < 1 ? value.toFixed(2) : value}
          {unit}
        </span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)`,
            transition: "width 0.1s",
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          marginTop: -6,
          opacity: 0,
          height: 18,
          cursor: "pointer",
          position: "relative",
          zIndex: 2,
        }}
      />
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 13,
        color: TEXT_SECONDARY,
        userSelect: "none",
      }}
    >
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? ACCENT : "rgba(255,255,255,0.12)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>
      {label}
    </label>
  );
}

// ─── Utility: id gen ────────────────────────────────────

let _idCounter = 0;
function uid(prefix = "fx") {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function EffectsEngine({
  selectedClipId,
  currentTime = 0,
  totalDuration = 30,
  onAddEffect,
  onColorFilterChange,
  onTextOverlay,
  onEmojiOverlay,
  onTransitionSelect,
}: EffectsEngineProps) {
  const [activeTab, setActiveTab] = useState<TabId>("zoom");
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  // ─── Zoom state ─────────────────────────
  const [customZoomScale, setCustomZoomScale] = useState(1.5);
  const [customZoomSpeed, setCustomZoomSpeed] = useState(1.0);
  const [autoZoomEmphasis, setAutoZoomEmphasis] = useState(false);

  // ─── Color state ────────────────────────
  const [activeColorPreset, setActiveColorPreset] = useState("original");
  const [customBrightness, setCustomBrightness] = useState(100);
  const [customContrast, setCustomContrast] = useState(100);
  const [customSaturation, setCustomSaturation] = useState(100);
  const [customHue, setCustomHue] = useState(0);
  const [customTemperature, setCustomTemperature] = useState(0);

  // ─── Filter state ──────────────────────
  const [enabledFilters, setEnabledFilters] = useState<Record<string, boolean>>({});
  const [filterIntensities, setFilterIntensities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    FILTER_DEFS.forEach((f) => (init[f.id] = f.defaultIntensity));
    return init;
  });
  const [blurArea, setBlurArea] = useState<"full" | "top" | "bottom" | "center">("full");

  // ─── Text state ─────────────────────────
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [editingText, setEditingText] = useState<TextOverlay | null>(null);

  // ─── Emoji state ────────────────────────
  const [emojiOverlays, setEmojiOverlays] = useState<EmojiOverlay[]>([]);
  const [emojiSearch, setEmojiSearch] = useState("");

  // ─── Transition state ──────────────────
  const [selectedTransition, setSelectedTransition] = useState("cut");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [applyToAll, setApplyToAll] = useState(false);
  const [wipeDirection, setWipeDirection] = useState<"horizontal" | "vertical">("horizontal");

  // ─── Computed custom CSS filter ────────
  const customCssFilter = useMemo(() => {
    const parts: string[] = [];
    if (customBrightness !== 100) parts.push(`brightness(${customBrightness / 100})`);
    if (customContrast !== 100) parts.push(`contrast(${customContrast / 100})`);
    if (customSaturation !== 100) parts.push(`saturate(${customSaturation / 100})`);
    if (customHue !== 0) parts.push(`hue-rotate(${customHue}deg)`);
    if (customTemperature > 0) parts.push(`sepia(${customTemperature / 100})`);
    if (customTemperature < 0) parts.push(`hue-rotate(${customTemperature}deg)`);
    return parts.length ? parts.join(" ") : "none";
  }, [customBrightness, customContrast, customSaturation, customHue, customTemperature]);

  // ─── Handlers ──────────────────────────

  const handleZoomPreset = useCallback(
    (preset: ZoomPreset) => {
      const kf: EffectKeyframe = {
        time: currentTime,
        type: preset.effectType,
        params: {
          scaleFrom: preset.scaleRange[0],
          scaleTo: preset.scaleRange[1],
          speed: preset.speed,
        },
        duration: preset.speed === "slow" ? totalDuration : preset.speed === "fast" ? 0.5 : 1.5,
      };
      onAddEffect?.(kf);
    },
    [currentTime, totalDuration, onAddEffect]
  );

  const handleCustomZoom = useCallback(() => {
    const kf: EffectKeyframe = {
      time: currentTime,
      type: "zoom-in",
      params: { scaleTo: customZoomScale, speed: customZoomSpeed },
      duration: 2 / customZoomSpeed,
    };
    onAddEffect?.(kf);
  }, [currentTime, customZoomScale, customZoomSpeed, onAddEffect]);

  const handleColorPreset = useCallback(
    (preset: ColorPreset) => {
      setActiveColorPreset(preset.id);
      onColorFilterChange?.(preset.cssFilter);
      if (preset.effectType !== "original") {
        const kf: EffectKeyframe = {
          time: 0,
          type: preset.effectType as EffectType,
          params: { cssFilter: preset.cssFilter },
          duration: totalDuration,
        };
        onAddEffect?.(kf);
      }
    },
    [totalDuration, onAddEffect, onColorFilterChange]
  );

  const handleApplyCustomColor = useCallback(() => {
    onColorFilterChange?.(customCssFilter);
  }, [customCssFilter, onColorFilterChange]);

  const handleAddText = useCallback(() => {
    const newText: TextOverlay = {
      id: uid("txt"),
      text: "Your text here",
      font: "Inter",
      size: 32,
      color: "#ffffff",
      x: 50,
      y: 50,
      animation: "fade-in",
      startTime: currentTime,
      duration: 3,
      isLowerThird: false,
    };
    setTextOverlays((prev) => [...prev, newText]);
    setEditingText(newText);
  }, [currentTime]);

  const handleAddLowerThird = useCallback(() => {
    const lt: TextOverlay = {
      id: uid("lt"),
      text: "Name",
      subtitle: "Title / Role",
      font: "Montserrat",
      size: 24,
      color: "#ffffff",
      x: 10,
      y: 80,
      animation: "slide-up",
      startTime: currentTime,
      duration: 4,
      isLowerThird: true,
    };
    setTextOverlays((prev) => [...prev, lt]);
    setEditingText(lt);
  }, [currentTime]);

  const handleUpdateEditingText = useCallback(
    (updates: Partial<TextOverlay>) => {
      if (!editingText) return;
      const updated = { ...editingText, ...updates };
      setEditingText(updated);
      setTextOverlays((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      onTextOverlay?.(updated);
    },
    [editingText, onTextOverlay]
  );

  const handleAddEmoji = useCallback(
    (emoji: string) => {
      const eo: EmojiOverlay = {
        id: uid("emj"),
        emoji,
        x: 50,
        y: 50,
        size: 48,
        animation: "pop",
        startTime: currentTime,
        duration: 2,
      };
      setEmojiOverlays((prev) => [...prev, eo]);
      onEmojiOverlay?.(eo);
    },
    [currentTime, onEmojiOverlay]
  );

  const handleTransition = useCallback(
    (def: TransitionDef) => {
      setSelectedTransition(def.id);
      onTransitionSelect?.(def.effectType, transitionDuration, applyToAll);
    },
    [transitionDuration, applyToAll, onTransitionSelect]
  );

  // ─── Render helpers ───────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case "zoom":
        return renderZoomTab();
      case "color":
        return renderColorTab();
      case "filters":
        return renderFiltersTab();
      case "text":
        return renderTextTab();
      case "emoji":
        return renderEmojiTab();
      case "transitions":
        return renderTransitionsTab();
    }
  };

  // ─── ZOOM TAB ──────────────────────────

  const renderZoomTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Presets */}
      <SectionLabel label="Zoom Presets" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {ZOOM_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleZoomPreset(p)}
            onMouseEnter={() => setHoveredPreset(p.id)}
            onMouseLeave={() => setHoveredPreset(null)}
            style={{
              ...glass(hoveredPreset === p.id ? 0.12 : 0.06),
              padding: "12px 10px",
              cursor: "pointer",
              textAlign: "left",
              border: `1px solid ${BORDER}`,
              transition: "all 0.25s ease",
              transform: hoveredPreset === p.id ? "scale(1.03)" : "scale(1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated preview on hover */}
            {hoveredPreset === p.id && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at center, ${ACCENT}15, transparent 70%)`,
                  animation: "zoomPulsePreview 1s ease-in-out infinite",
                }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1 }}>
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 4 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{p.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Zoom */}
      <SectionLabel label="Custom Zoom" />
      <div style={{ ...glass(), padding: 14 }}>
        <Slider label="Scale" value={customZoomScale} min={1.0} max={3.0} step={0.1} unit="x" onChange={setCustomZoomScale} />
        <Slider label="Speed" value={customZoomSpeed} min={0.1} max={3.0} step={0.1} unit="x" onChange={setCustomZoomSpeed} />
        <button
          onClick={handleCustomZoom}
          style={{
            ...btnBase,
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            marginTop: 4,
          }}
        >
          Apply Custom Zoom
        </button>
      </div>

      {/* Auto-zoom toggle */}
      <div style={{ ...glass(), padding: 14 }}>
        <Toggle checked={autoZoomEmphasis} onChange={setAutoZoomEmphasis} label="Auto-zoom on emphasis (AI)" />
        {autoZoomEmphasis && (
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.5 }}>
            AI will analyse word emphasis and automatically apply quick zoom on key moments.
          </p>
        )}
      </div>
    </div>
  );

  // ─── COLOR TAB ─────────────────────────

  const renderColorTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Color Presets" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleColorPreset(p)}
            onMouseEnter={() => setHoveredPreset(p.id)}
            onMouseLeave={() => setHoveredPreset(null)}
            style={{
              ...btnBase,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: 6,
              borderRadius: 10,
              border: activeColorPreset === p.id ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
              transition: "all 0.2s ease",
              transform: hoveredPreset === p.id ? "scale(1.08)" : "scale(1)",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "16/9",
                borderRadius: 6,
                background: p.thumbnail,
                filter: p.cssFilter !== "none" ? p.cssFilter : undefined,
                transition: "transform 0.3s ease",
                transform: hoveredPreset === p.id ? "scale(1.1)" : "scale(1)",
              }}
            />
            <span style={{ fontSize: 10, color: activeColorPreset === p.id ? ACCENT : TEXT_MUTED, fontWeight: 600 }}>
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {/* Custom sliders */}
      <SectionLabel label="Custom Adjustment" />
      <div style={{ ...glass(), padding: 14 }}>
        <Slider label="Brightness" value={customBrightness} min={20} max={200} unit="%" onChange={setCustomBrightness} />
        <Slider label="Contrast" value={customContrast} min={20} max={200} unit="%" onChange={setCustomContrast} />
        <Slider label="Saturation" value={customSaturation} min={0} max={200} unit="%" onChange={setCustomSaturation} />
        <Slider label="Hue Rotate" value={customHue} min={-180} max={180} unit="°" onChange={setCustomHue} />
        <Slider label="Temperature" value={customTemperature} min={-50} max={50} onChange={setCustomTemperature} />

        {/* Live preview box */}
        <div
          style={{
            width: "100%",
            height: 48,
            borderRadius: 8,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            filter: customCssFilter,
            marginTop: 6,
            marginBottom: 8,
          }}
        />

        <button
          onClick={handleApplyCustomColor}
          style={{
            ...btnBase,
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Apply Custom Color
        </button>
      </div>
    </div>
  );

  // ─── FILTERS TAB ──────────────────────

  const renderFiltersTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel label="Filters" />
      {FILTER_DEFS.map((f) => {
        const enabled = !!enabledFilters[f.id];
        const intensity = filterIntensities[f.id] ?? f.defaultIntensity;
        return (
          <div
            key={f.id}
            onMouseEnter={() => setHoveredPreset(f.id)}
            onMouseLeave={() => setHoveredPreset(null)}
            style={{
              ...glass(enabled ? 0.1 : 0.04),
              padding: 12,
              transition: "all 0.2s",
              border: enabled ? `1px solid ${ACCENT}44` : `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: enabled ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED }}>{f.description}</div>
                </div>
              </div>
              <Toggle
                checked={enabled}
                onChange={(v) => {
                  setEnabledFilters((prev) => ({ ...prev, [f.id]: v }));
                  if (v) {
                    const kf: EffectKeyframe = {
                      time: currentTime,
                      type: f.effectType,
                      params: { intensity, area: f.id === "blur" ? blurArea : "full" },
                      duration: totalDuration - currentTime,
                    };
                    onAddEffect?.(kf);
                  }
                }}
                label=""
              />
            </div>
            {enabled && (
              <div>
                <Slider
                  label="Intensity"
                  value={intensity}
                  min={f.min}
                  max={f.max}
                  unit={f.unit}
                  onChange={(v) => setFilterIntensities((prev) => ({ ...prev, [f.id]: v }))}
                />
                {f.id === "blur" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {(["full", "top", "bottom", "center"] as const).map((area) => (
                      <button
                        key={area}
                        onClick={() => setBlurArea(area)}
                        style={{
                          ...btnBase,
                          fontSize: 11,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: blurArea === area ? ACCENT : "rgba(255,255,255,0.06)",
                          color: blurArea === area ? "#fff" : TEXT_MUTED,
                          fontWeight: 500,
                        }}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── TEXT TAB ──────────────────────────

  const renderTextTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Text Overlays" />

      {/* Add buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleAddText}
          style={{
            ...btnBase,
            flex: 1,
            padding: "10px 0",
            borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          + Add Text
        </button>
        <button
          onClick={handleAddLowerThird}
          style={{
            ...btnBase,
            flex: 1,
            padding: "10px 0",
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            color: TEXT_PRIMARY,
            fontWeight: 600,
            fontSize: 13,
            border: `1px solid ${BORDER}`,
          }}
        >
          + Lower Third
        </button>
      </div>

      {/* Existing overlays */}
      {textOverlays.map((t) => (
        <button
          key={t.id}
          onClick={() => setEditingText(t)}
          style={{
            ...glass(editingText?.id === t.id ? 0.12 : 0.06),
            padding: 10,
            cursor: "pointer",
            textAlign: "left",
            border: editingText?.id === t.id ? `1px solid ${ACCENT}66` : `1px solid ${BORDER}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
            {t.isLowerThird ? "📋 " : "𝐓 "}
            {t.text}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>
            {t.font} · {t.animation} · {t.duration}s
          </div>
        </button>
      ))}

      {/* Text editor */}
      {editingText && (
        <div style={{ ...glass(0.08), padding: 14 }}>
          <SectionLabel label={editingText.isLowerThird ? "Edit Lower Third" : "Edit Text"} />

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Text</label>
            <input
              value={editingText.text}
              onChange={(e) => handleUpdateEditingText({ text: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,0.3)",
                color: TEXT_PRIMARY,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {editingText.isLowerThird && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Subtitle</label>
              <input
                value={editingText.subtitle || ""}
                onChange={(e) => handleUpdateEditingText({ subtitle: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.3)",
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Font selector */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Font</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {GOOGLE_FONTS.map((font) => (
                <button
                  key={font}
                  onClick={() => handleUpdateEditingText({ font })}
                  style={{
                    ...btnBase,
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: editingText.font === font ? ACCENT : "rgba(255,255,255,0.06)",
                    color: editingText.font === font ? "#fff" : TEXT_MUTED,
                    fontFamily: font,
                    fontWeight: 500,
                  }}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED }}>Color</label>
            <input
              type="color"
              value={editingText.color}
              onChange={(e) => handleUpdateEditingText({ color: e.target.value })}
              style={{ width: 32, height: 24, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }}
            />
            <Slider
              label="Size"
              value={editingText.size}
              min={12}
              max={120}
              unit="px"
              onChange={(v) => handleUpdateEditingText({ size: v })}
            />
          </div>

          {/* Position */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <Slider label="X %" value={editingText.x} min={0} max={100} unit="%" onChange={(v) => handleUpdateEditingText({ x: v })} />
            </div>
            <div style={{ flex: 1 }}>
              <Slider label="Y %" value={editingText.y} min={0} max={100} unit="%" onChange={(v) => handleUpdateEditingText({ y: v })} />
            </div>
          </div>

          {/* Animation */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Animation</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["none", "fade-in", "slide-up", "typewriter", "bounce"] as TextAnimation[]).map((anim) => (
                <button
                  key={anim}
                  onClick={() => handleUpdateEditingText({ animation: anim })}
                  style={{
                    ...btnBase,
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: editingText.animation === anim ? ACCENT : "rgba(255,255,255,0.06)",
                    color: editingText.animation === anim ? "#fff" : TEXT_MUTED,
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {anim}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <Slider label="Duration" value={editingText.duration} min={0.5} max={30} step={0.5} unit="s" onChange={(v) => handleUpdateEditingText({ duration: v })} />

          {/* Lower-third preview */}
          {editingText.isLowerThird && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 16px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.6)",
                borderLeft: `3px solid ${ACCENT}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  height: 2,
                  background: `linear-gradient(90deg, ${ACCENT}, transparent)`,
                  width: "100%",
                  animation: "slideInBar 0.6s ease-out",
                }}
              />
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: editingText.font }}>{editingText.text}</div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: editingText.font }}>{editingText.subtitle}</div>
            </div>
          )}

          {/* Delete */}
          <button
            onClick={() => {
              setTextOverlays((prev) => prev.filter((t) => t.id !== editingText.id));
              setEditingText(null);
            }}
            style={{
              ...btnBase,
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              background: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              fontWeight: 600,
              fontSize: 13,
              marginTop: 8,
            }}
          >
            Delete Text
          </button>
        </div>
      )}
    </div>
  );

  // ─── EMOJI TAB ─────────────────────────

  const renderEmojiTab = () => {
    const filtered = emojiSearch
      ? POPULAR_EMOJI.filter(() => true) // emoji themselves don't have text to search; keep all
      : POPULAR_EMOJI;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionLabel label="Emoji / Stickers" />

        {/* Search (placeholder for future keyword matching) */}
        <input
          placeholder="Search emoji..."
          value={emojiSearch}
          onChange={(e) => setEmojiSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "rgba(0,0,0,0.3)",
            color: TEXT_PRIMARY,
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Picker grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 4,
            maxHeight: 240,
            overflowY: "auto",
            ...glass(),
            padding: 8,
          }}
        >
          {filtered.map((em, i) => (
            <button
              key={i}
              onClick={() => handleAddEmoji(em)}
              onMouseEnter={() => setHoveredPreset(`em-${i}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...btnBase,
                fontSize: 22,
                padding: 4,
                borderRadius: 6,
                background: hoveredPreset === `em-${i}` ? "rgba(255,255,255,0.1)" : "transparent",
                transform: hoveredPreset === `em-${i}` ? "scale(1.3)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
              title={em}
            >
              {em}
            </button>
          ))}
        </div>

        {/* Active emoji overlays */}
        {emojiOverlays.length > 0 && (
          <>
            <SectionLabel label="Active Emoji" />
            {emojiOverlays.map((eo) => (
              <div key={eo.id} style={{ ...glass(), padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{eo.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, color: TEXT_PRIMARY }}>{eo.animation}</div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>{eo.duration}s at {eo.startTime.toFixed(1)}s</div>
                  </div>
                </div>
                {/* Animation selector */}
                <div style={{ display: "flex", gap: 3 }}>
                  {(["bounce", "rotate", "fade", "pop", "float"] as EmojiAnimation[]).map((anim) => (
                    <button
                      key={anim}
                      onClick={() => {
                        setEmojiOverlays((prev) =>
                          prev.map((e) => (e.id === eo.id ? { ...e, animation: anim } : e))
                        );
                      }}
                      style={{
                        ...btnBase,
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: eo.animation === anim ? ACCENT : "rgba(255,255,255,0.06)",
                        color: eo.animation === anim ? "#fff" : TEXT_MUTED,
                      }}
                    >
                      {anim}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Duration & timing for last emoji */}
            {emojiOverlays.length > 0 && (
              <div style={{ ...glass(), padding: 12 }}>
                <Slider
                  label="Duration"
                  value={emojiOverlays[emojiOverlays.length - 1].duration}
                  min={0.5}
                  max={10}
                  step={0.5}
                  unit="s"
                  onChange={(v) => {
                    const lastId = emojiOverlays[emojiOverlays.length - 1].id;
                    setEmojiOverlays((prev) => prev.map((e) => (e.id === lastId ? { ...e, duration: v } : e)));
                  }}
                />
                <Slider
                  label="Size"
                  value={emojiOverlays[emojiOverlays.length - 1].size}
                  min={16}
                  max={128}
                  unit="px"
                  onChange={(v) => {
                    const lastId = emojiOverlays[emojiOverlays.length - 1].id;
                    setEmojiOverlays((prev) => prev.map((e) => (e.id === lastId ? { ...e, size: v } : e)));
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─── TRANSITIONS TAB ──────────────────

  const renderTransitionsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Transitions" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TRANSITION_DEFS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTransition(t)}
            onMouseEnter={() => setHoveredPreset(`tr-${t.id}`)}
            onMouseLeave={() => setHoveredPreset(null)}
            style={{
              ...glass(selectedTransition === t.id ? 0.14 : 0.06),
              padding: 10,
              cursor: "pointer",
              textAlign: "left",
              border: selectedTransition === t.id ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
              transition: "all 0.25s ease",
              transform: hoveredPreset === `tr-${t.id}` ? "scale(1.04)" : "scale(1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Preview bar animation */}
            <div
              style={{
                width: "100%",
                height: 32,
                borderRadius: 6,
                background: t.previewGradient,
                marginBottom: 6,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {hoveredPreset === `tr-${t.id}` && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.1)",
                    animation:
                      t.id === "crossfade"
                        ? "fadeInOut 1.5s infinite"
                        : t.id === "slide"
                        ? "slidePreview 1s infinite"
                        : t.id === "zoom-transition"
                        ? "zoomPulsePreview 1s infinite"
                        : t.id === "glitch-transition"
                        ? "glitchPreview 0.5s infinite"
                        : t.id === "wipe"
                        ? "wipePreview 1.2s infinite"
                        : "none",
                  }}
                />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>{t.label}</div>
                <div style={{ fontSize: 10, color: TEXT_MUTED }}>{t.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Wipe direction (only when wipe selected) */}
      {selectedTransition === "wipe" && (
        <div style={{ ...glass(), padding: 12 }}>
          <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 6 }}>Wipe Direction</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["horizontal", "vertical"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setWipeDirection(dir)}
                style={{
                  ...btnBase,
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 6,
                  background: wipeDirection === dir ? ACCENT : "rgba(255,255,255,0.06)",
                  color: wipeDirection === dir ? "#fff" : TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: "capitalize",
                }}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duration slider */}
      <div style={{ ...glass(), padding: 14 }}>
        <Slider
          label="Transition Duration"
          value={transitionDuration}
          min={0.3}
          max={2.0}
          step={0.1}
          unit="s"
          onChange={(v) => {
            setTransitionDuration(v);
            const def = TRANSITION_DEFS.find((d) => d.id === selectedTransition);
            if (def) onTransitionSelect?.(def.effectType, v, applyToAll);
          }}
        />
      </div>

      {/* Apply to */}
      <div style={{ ...glass(), padding: 12 }}>
        <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 6 }}>Apply To</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setApplyToAll(false)}
            style={{
              ...btnBase,
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              background: !applyToAll ? ACCENT : "rgba(255,255,255,0.06)",
              color: !applyToAll ? "#fff" : TEXT_MUTED,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Selected Clip
          </button>
          <button
            onClick={() => setApplyToAll(true)}
            style={{
              ...btnBase,
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              background: applyToAll ? ACCENT : "rgba(255,255,255,0.06)",
              color: applyToAll ? "#fff" : TEXT_MUTED,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            All Clips
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        color: TEXT_PRIMARY,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ─── Inline keyframes ─── */}
      <style>{`
        @keyframes zoomPulsePreview {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.4; }
        }
        @keyframes slidePreview {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes glitchPreview {
          0%, 100% { transform: translate(0); filter: none; }
          20% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
          40% { transform: translate(2px, -1px); filter: hue-rotate(180deg); }
          60% { transform: translate(-1px, -2px); filter: hue-rotate(270deg); }
          80% { transform: translate(1px, 2px); filter: saturate(2); }
        }
        @keyframes wipePreview {
          0% { clip-path: inset(0 100% 0 0); }
          50% { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 0 0 100%); }
        }
        @keyframes slideInBar {
          from { width: 0; }
          to { width: 100%; }
        }
        /* Scrollbar */
        .fx-scroll::-webkit-scrollbar { width: 4px; }
        .fx-scroll::-webkit-scrollbar-track { background: transparent; }
        .fx-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
        .fx-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }
      `}</style>

      {/* ─── Tab Bar ─── */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 4px",
          flexShrink: 0,
          background: "rgba(0,0,0,0.3)",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...btnBase,
              flex: 1,
              padding: "10px 4px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_MUTED,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              transition: "color 0.2s",
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {/* Active indicator — gradient underline */}
            {activeTab === tab.id && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "15%",
                  right: "15%",
                  height: 2,
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)`,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      <div
        className="fx-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
        }}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}

// ─── Section Label ──────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: TEXT_MUTED,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 2,
      }}
    >
      {label}
    </div>
  );
}
