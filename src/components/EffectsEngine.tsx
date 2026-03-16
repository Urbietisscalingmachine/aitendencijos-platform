"use client";
/* ═══════════════════════════════════════════════════════════
   CINEFLOW — Effects Engine (FULL)
   6 tabs: Zoom | Color | Filters | Text | Emoji | Transitions
   30 Filters · 22 Color Grading Presets · 10 Zoom · 10 Transitions
   + Auto Zoom on Emphasis
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

// ─── 30 Filter Definitions ─────────────────────────────

export interface FilterPreset {
  id: string;
  label: string;
  icon: string;
  effectType: EffectType;
  /** CSS filter string applied to the video element */
  cssFilter: string;
  /** If true, this filter requires an overlay pseudo-element (not pure CSS filter) */
  needsOverlay: boolean;
  /** CSS for the overlay div (if needsOverlay) */
  overlayCSS?: React.CSSProperties;
  description: string;
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "blur", label: "Blur", icon: "🌫️", effectType: "filter-blur", cssFilter: "blur(2px)", needsOverlay: false, description: "Gaussian blur 2px" },
  { id: "sharpen", label: "Sharpen", icon: "🔪", effectType: "filter-sharpen", cssFilter: "contrast(1.2) saturate(1.1)", needsOverlay: false, description: "Increased contrast + saturation" },
  { id: "vignette", label: "Vignette", icon: "🔲", effectType: "filter-vignette", cssFilter: "none", needsOverlay: true, overlayCSS: { boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.7)", pointerEvents: "none" as const }, description: "Dark edges vignette" },
  { id: "warm", label: "Warm", icon: "🌅", effectType: "filter-warm", cssFilter: "sepia(0.3) saturate(1.2)", needsOverlay: false, description: "Warm tone" },
  { id: "cool", label: "Cool", icon: "❄️", effectType: "filter-cool", cssFilter: "hue-rotate(30deg) saturate(0.9)", needsOverlay: false, description: "Cool blue tone" },
  { id: "vintage", label: "Vintage", icon: "📷", effectType: "filter-vintage", cssFilter: "sepia(0.5) contrast(0.9) brightness(1.1)", needsOverlay: false, description: "Vintage film look" },
  { id: "sepia", label: "Sepia", icon: "🟤", effectType: "filter-sepia", cssFilter: "sepia(1)", needsOverlay: false, description: "Full sepia" },
  { id: "bw", label: "B&W", icon: "⬛", effectType: "filter-bw", cssFilter: "grayscale(1)", needsOverlay: false, description: "Black & white" },
  { id: "high-contrast", label: "High Contrast", icon: "◐", effectType: "filter-high-contrast", cssFilter: "contrast(1.5)", needsOverlay: false, description: "Strong contrast" },
  { id: "low-contrast", label: "Low Contrast", icon: "◑", effectType: "filter-low-contrast", cssFilter: "contrast(0.7)", needsOverlay: false, description: "Soft contrast" },
  { id: "saturated", label: "Saturated", icon: "🌈", effectType: "filter-saturated", cssFilter: "saturate(2)", needsOverlay: false, description: "Vivid colors" },
  { id: "desaturated", label: "Desaturated", icon: "🩶", effectType: "filter-desaturated", cssFilter: "saturate(0.3)", needsOverlay: false, description: "Muted colors" },
  { id: "film-grain", label: "Film Grain", icon: "📺", effectType: "filter-film-grain", cssFilter: "none", needsOverlay: true, overlayCSS: { backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", opacity: 0.15, mixBlendMode: "overlay" as const, pointerEvents: "none" as const }, description: "Noise overlay" },
  { id: "glitch", label: "Glitch", icon: "📡", effectType: "filter-glitch", cssFilter: "hue-rotate(90deg) saturate(1.5)", needsOverlay: false, description: "Hue shift glitch" },
  { id: "chromatic", label: "Chromatic Aberration", icon: "🔴", effectType: "filter-chromatic", cssFilter: "none", needsOverlay: true, overlayCSS: { textShadow: "-2px 0 red, 2px 0 cyan", mixBlendMode: "screen" as const, opacity: 0.3, pointerEvents: "none" as const, background: "linear-gradient(90deg, rgba(255,0,0,0.05), transparent 33%, rgba(0,255,0,0.05) 33%, transparent 66%, rgba(0,0,255,0.05) 66%)" }, description: "RGB split effect" },
  { id: "duotone", label: "Duotone", icon: "🎭", effectType: "filter-duotone", cssFilter: "grayscale(1) sepia(1) hue-rotate(180deg)", needsOverlay: false, description: "Two-tone color" },
  { id: "split-tone", label: "Split Tone", icon: "🌓", effectType: "filter-split-tone", cssFilter: "sepia(0.2) hue-rotate(-20deg) saturate(1.1)", needsOverlay: false, description: "Warm highlights, cool shadows" },
  { id: "cross-process", label: "Cross Process", icon: "🧪", effectType: "filter-cross-process", cssFilter: "hue-rotate(90deg) saturate(1.5)", needsOverlay: false, description: "Cross-processed look" },
  { id: "teal-orange", label: "Teal & Orange", icon: "🟠", effectType: "filter-teal-orange", cssFilter: "hue-rotate(150deg) saturate(1.3)", needsOverlay: false, description: "Hollywood teal & orange" },
  { id: "cinematic-bars", label: "Cinematic Bars", icon: "🎬", effectType: "filter-cinematic-bars", cssFilter: "none", needsOverlay: true, overlayCSS: { background: "linear-gradient(to bottom, #000 8%, transparent 8%, transparent 92%, #000 92%)", pointerEvents: "none" as const }, description: "Letterbox bars" },
  { id: "light-leak", label: "Light Leak", icon: "☀️", effectType: "filter-light-leak", cssFilter: "none", needsOverlay: true, overlayCSS: { background: "linear-gradient(135deg, rgba(255,150,50,0.25) 0%, transparent 40%, rgba(255,100,100,0.15) 80%)", mixBlendMode: "screen" as const, pointerEvents: "none" as const }, description: "Warm light leak" },
  { id: "lens-flare", label: "Lens Flare", icon: "💫", effectType: "filter-lens-flare", cssFilter: "none", needsOverlay: true, overlayCSS: { background: "radial-gradient(circle at 30% 30%, rgba(255,255,200,0.35) 0%, transparent 50%)", mixBlendMode: "screen" as const, pointerEvents: "none" as const }, description: "Lens flare glow" },
  { id: "bokeh", label: "Bokeh", icon: "🔵", effectType: "filter-bokeh", cssFilter: "blur(1px) brightness(1.05)", needsOverlay: true, overlayCSS: { background: "radial-gradient(circle 4px at 20% 30%, rgba(255,255,255,0.15) 100%, transparent 100%), radial-gradient(circle 6px at 70% 20%, rgba(255,255,255,0.1) 100%, transparent 100%), radial-gradient(circle 3px at 50% 70%, rgba(255,255,255,0.12) 100%, transparent 100%), radial-gradient(circle 5px at 80% 60%, rgba(255,255,255,0.08) 100%, transparent 100%)", pointerEvents: "none" as const }, description: "Bokeh blur overlay" },
  { id: "motion-blur", label: "Motion Blur", icon: "💨", effectType: "filter-motion-blur", cssFilter: "blur(1px)", needsOverlay: false, description: "Directional blur" },
  { id: "pixelate", label: "Pixelate", icon: "🟩", effectType: "filter-pixelate", cssFilter: "none", needsOverlay: false, description: "Pixelated look" },
  { id: "posterize", label: "Posterize", icon: "🎨", effectType: "filter-posterize", cssFilter: "contrast(2) saturate(0.5)", needsOverlay: false, description: "Poster-like contrast" },
  { id: "solarize", label: "Solarize", icon: "🌞", effectType: "filter-solarize", cssFilter: "invert(0.8) hue-rotate(180deg)", needsOverlay: false, description: "Solarized inversion" },
  { id: "emboss", label: "Emboss", icon: "🪨", effectType: "filter-emboss", cssFilter: "drop-shadow(1px 1px 0 rgba(255,255,255,0.5)) drop-shadow(-1px -1px 0 rgba(0,0,0,0.5)) contrast(1.2)", needsOverlay: false, description: "Emboss via drop-shadow" },
  { id: "hdr", label: "HDR", icon: "🔆", effectType: "filter-hdr", cssFilter: "contrast(1.3) saturate(1.4) brightness(1.1)", needsOverlay: false, description: "HDR-like enhancement" },
  { id: "dreamy-glow", label: "Dreamy Glow", icon: "✨", effectType: "filter-dreamy-glow", cssFilter: "blur(1px) brightness(1.2) contrast(0.9)", needsOverlay: false, description: "Soft dreamy glow" },
];

// ─── 22 Color Grading Presets ───────────────────────────

export interface ColorGradingPreset {
  id: string;
  label: string;
  effectType: EffectType;
  cssFilter: string;
  thumbnail: string;
}

export const COLOR_GRADING_PRESETS: ColorGradingPreset[] = [
  { id: "original", label: "Original", effectType: "color-warm" as EffectType, cssFilter: "none", thumbnail: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "warm-sunset", label: "Warm Sunset", effectType: "color-warm-sunset", cssFilter: "sepia(0.2) saturate(1.3) brightness(1.1)", thumbnail: "linear-gradient(135deg, #f5af19, #f12711)" },
  { id: "cool-blue", label: "Cool Blue", effectType: "color-cool-blue", cssFilter: "hue-rotate(200deg) saturate(0.8)", thumbnail: "linear-gradient(135deg, #667eea, #00d2ff)" },
  { id: "vintage-film", label: "Vintage Film", effectType: "color-vintage-film", cssFilter: "sepia(0.4) contrast(0.85) brightness(1.1)", thumbnail: "linear-gradient(135deg, #d4a574, #8b6914)" },
  { id: "dramatic", label: "Dramatic", effectType: "color-dramatic", cssFilter: "contrast(1.4) brightness(0.9) saturate(0.7)", thumbnail: "linear-gradient(135deg, #1a1a2e, #16213e)" },
  { id: "teal-orange", label: "Teal & Orange", effectType: "color-teal-orange", cssFilter: "hue-rotate(150deg) saturate(1.3) contrast(1.1)", thumbnail: "linear-gradient(135deg, #008080, #ff8c00)" },
  { id: "film-noir", label: "Film Noir", effectType: "color-film-noir", cssFilter: "grayscale(0.8) contrast(1.3)", thumbnail: "linear-gradient(135deg, #111, #555)" },
  { id: "bleach-bypass", label: "Bleach Bypass", effectType: "color-bleach-bypass", cssFilter: "saturate(0.4) contrast(1.3)", thumbnail: "linear-gradient(135deg, #8e9eab, #eef2f3)" },
  { id: "golden-hour", label: "Golden Hour", effectType: "color-golden-hour", cssFilter: "sepia(0.15) saturate(1.2) brightness(1.15)", thumbnail: "linear-gradient(135deg, #f7971e, #ffd200)" },
  { id: "moonlight", label: "Moonlight", effectType: "color-moonlight", cssFilter: "hue-rotate(210deg) brightness(0.85) saturate(0.6)", thumbnail: "linear-gradient(135deg, #0f2027, #203a43)" },
  { id: "pastel", label: "Pastel", effectType: "color-pastel", cssFilter: "saturate(0.5) brightness(1.2)", thumbnail: "linear-gradient(135deg, #fbc2eb, #a6c1ee)" },
  { id: "matte", label: "Matte", effectType: "color-matte", cssFilter: "contrast(0.8) brightness(1.1)", thumbnail: "linear-gradient(135deg, #bdc3c7, #2c3e50)" },
  { id: "faded", label: "Faded", effectType: "color-faded", cssFilter: "contrast(0.85) saturate(0.7) brightness(1.1)", thumbnail: "linear-gradient(135deg, #cfd9df, #e2ebf0)" },
  { id: "cyberpunk", label: "Cyberpunk", effectType: "color-cyberpunk", cssFilter: "hue-rotate(280deg) saturate(1.5) contrast(1.2)", thumbnail: "linear-gradient(135deg, #fc00ff, #00dbde)" },
  { id: "neon-night", label: "Neon Night", effectType: "color-neon-night", cssFilter: "hue-rotate(260deg) saturate(2) brightness(0.8)", thumbnail: "linear-gradient(135deg, #6a0dad, #ff006e)" },
  { id: "nordic", label: "Nordic", effectType: "color-nordic", cssFilter: "saturate(0.6) brightness(1.05) hue-rotate(180deg)", thumbnail: "linear-gradient(135deg, #e6dada, #274046)" },
  { id: "desert", label: "Desert", effectType: "color-desert", cssFilter: "sepia(0.3) saturate(0.8) brightness(1.1)", thumbnail: "linear-gradient(135deg, #eecda3, #ef629f)" },
  { id: "forest", label: "Forest", effectType: "color-forest", cssFilter: "hue-rotate(90deg) saturate(0.9)", thumbnail: "linear-gradient(135deg, #134e5e, #71b280)" },
  { id: "ocean", label: "Ocean", effectType: "color-ocean", cssFilter: "hue-rotate(170deg) saturate(1.1)", thumbnail: "linear-gradient(135deg, #1a2980, #26d0ce)" },
  { id: "tropical", label: "Tropical", effectType: "color-tropical", cssFilter: "saturate(1.5) brightness(1.1)", thumbnail: "linear-gradient(135deg, #11998e, #38ef7d)" },
  { id: "high-key", label: "High Key", effectType: "color-high-key", cssFilter: "brightness(1.3) contrast(0.8)", thumbnail: "linear-gradient(135deg, #fff, #ddd)" },
  { id: "low-key", label: "Low Key", effectType: "color-low-key", cssFilter: "brightness(0.7) contrast(1.3)", thumbnail: "linear-gradient(135deg, #000, #333)" },
  { id: "cinematic-orange", label: "Cinematic Orange", effectType: "color-cinematic-orange", cssFilter: "sepia(0.2) saturate(1.2) hue-rotate(10deg)", thumbnail: "linear-gradient(135deg, #c94b4b, #4b134f)" },
];

// ─── 10 Zoom Presets ────────────────────────────────────

export interface ZoomPreset {
  id: string;
  label: string;
  description: string;
  effectType: EffectType;
  icon: string;
  /** CSS transform value at peak */
  cssTransform: string;
  /** CSS transition/animation string */
  cssTransition: string;
  /** Duration in seconds for the zoom effect clip */
  duration: number;
}

export const ZOOM_PRESETS: ZoomPreset[] = [
  { id: "slow-zoom-in", label: "Slow Zoom In", description: "Scale 1→1.3 over 3s", effectType: "zoom-in", icon: "🔍", cssTransform: "scale(1.3)", cssTransition: "transform 3s ease", duration: 3 },
  { id: "fast-punch", label: "Fast Punch Zoom", description: "Scale 1→1.5 in 0.3s", effectType: "zoom-fast-punch", icon: "⚡", cssTransform: "scale(1.5)", cssTransition: "transform 0.3s ease-out", duration: 0.5 },
  { id: "zoom-out", label: "Zoom Out", description: "Scale 1.3→1 over 2s", effectType: "zoom-out", icon: "🔭", cssTransform: "scale(1)", cssTransition: "transform 2s ease", duration: 2 },
  { id: "ken-burns", label: "Ken Burns", description: "Slow scale + pan", effectType: "ken-burns", icon: "🎬", cssTransform: "scale(1.2) translateX(3%)", cssTransition: "transform 5s ease-in-out", duration: 5 },
  { id: "dolly-zoom", label: "Dolly Zoom (Vertigo)", description: "Scale in + translateY", effectType: "zoom-dolly", icon: "🎥", cssTransform: "scale(1.3) translateY(-2%)", cssTransition: "transform 2s ease-in-out", duration: 2 },
  { id: "snap-zoom", label: "Snap Zoom", description: "Instant scale 1→1.4", effectType: "zoom-snap", icon: "💥", cssTransform: "scale(1.4)", cssTransition: "transform 0.1s ease-out", duration: 0.3 },
  { id: "bounce-zoom", label: "Bounce Zoom", description: "Scale up then back", effectType: "zoom-bounce", icon: "🏀", cssTransform: "scale(1.2)", cssTransition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)", duration: 0.5 },
  { id: "breathe", label: "Breathe", description: "Subtle 1→1.05→1 pulse", effectType: "zoom-breathe", icon: "🌬️", cssTransform: "scale(1.05)", cssTransition: "transform 2s ease-in-out", duration: 4 },
  { id: "focus-pull", label: "Focus Pull", description: "Scale center + blur edges", effectType: "zoom-focus-pull", icon: "🎯", cssTransform: "scale(1.15)", cssTransition: "transform 1.5s ease-in-out", duration: 1.5 },
  { id: "dramatic-push", label: "Dramatic Push", description: "Slow→fast zoom", effectType: "zoom-dramatic-push", icon: "🚀", cssTransform: "scale(1.4)", cssTransition: "transform 2s ease-in", duration: 2 },
];

// ─── 10 Transition Definitions ──────────────────────────

export interface TransitionDef {
  id: string;
  label: string;
  icon: string;
  effectType: EffectType;
  description: string;
  previewGradient: string;
  /** CSS description for the transition */
  cssDescription: string;
}

export const TRANSITION_DEFS: TransitionDef[] = [
  { id: "fade", label: "Fade / Cross Dissolve", icon: "🌅", effectType: "transition-fade", description: "Opacity blend", previewGradient: "linear-gradient(90deg, #6366f1, transparent, #a855f7)", cssDescription: "opacity 1→0→1" },
  { id: "slide-left", label: "Slide Left", icon: "⬅️", effectType: "transition-slide-left", description: "Slide to left", previewGradient: "linear-gradient(90deg, #3b82f6 45%, #8b5cf6 55%)", cssDescription: "translateX 0→-100%" },
  { id: "slide-right", label: "Slide Right", icon: "➡️", effectType: "transition-slide-right", description: "Slide to right", previewGradient: "linear-gradient(90deg, #8b5cf6 45%, #3b82f6 55%)", cssDescription: "translateX 0→100%" },
  { id: "slide-up", label: "Slide Up", icon: "⬆️", effectType: "transition-slide-up", description: "Slide upward", previewGradient: "linear-gradient(180deg, #3b82f6 45%, #8b5cf6 55%)", cssDescription: "translateY 0→-100%" },
  { id: "wipe", label: "Wipe", icon: "🧹", effectType: "transition-wipe", description: "Clip-path reveal", previewGradient: "linear-gradient(90deg, #8b5cf6 50%, transparent 50%)", cssDescription: "clip-path inset reveal" },
  { id: "zoom-transition", label: "Zoom Transition", icon: "🔎", effectType: "transition-zoom", description: "Scale up → next scene", previewGradient: "radial-gradient(circle, #8b5cf6, #1e1b4b)", cssDescription: "scale up → out" },
  { id: "spin", label: "Spin", icon: "🌀", effectType: "transition-spin", description: "Rotate 360°", previewGradient: "conic-gradient(from 0deg, #6366f1, #a855f7, #6366f1)", cssDescription: "rotate 360deg" },
  { id: "blur-transition", label: "Blur Transition", icon: "🌫️", effectType: "transition-blur", description: "Blur → unblur", previewGradient: "linear-gradient(90deg, rgba(99,102,241,0.3), #6366f1, rgba(99,102,241,0.3))", cssDescription: "blur → sharp" },
  { id: "flash-white", label: "Flash White", icon: "⚡", effectType: "transition-flash", description: "White flash overlay", previewGradient: "linear-gradient(90deg, #333, #fff, #333)", cssDescription: "white overlay fade" },
  { id: "glitch-trans", label: "Glitch", icon: "📡", effectType: "transition-glitch-rgb", description: "RGB split + shake", previewGradient: "linear-gradient(90deg, #ef4444, #22c55e, #3b82f6)", cssDescription: "RGB split + shake 0.3s" },
];

// ─── Text / Fonts ───────────────────────────────────────

const GOOGLE_FONTS = [
  "Inter", "Roboto", "Montserrat", "Poppins", "Oswald",
  "Playfair Display", "Bebas Neue", "Raleway", "Space Grotesk", "Permanent Marker",
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
  subtitle?: string;
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

// ─── Exported Callbacks ─────────────────────────────────

export interface EffectsEngineProps {
  selectedClipId?: string;
  currentTime?: number;
  totalDuration?: number;
  onAddEffect?: (keyframe: EffectKeyframe) => void;
  onColorFilterChange?: (cssFilter: string) => void;
  /** NEW: called when a filter is toggled (filter CSS + overlay info) */
  onFilterChange?: (filter: { cssFilter: string; overlayCSS?: React.CSSProperties; filterId: string } | null) => void;
  /** NEW: called when active zoom CSS changes */
  onZoomChange?: (zoom: { cssTransform: string; cssTransition: string; zoomId: string } | null) => void;
  onTextOverlay?: (overlay: TextOverlay) => void;
  onEmojiOverlay?: (overlay: EmojiOverlay) => void;
  onTransitionSelect?: (type: EffectType, duration: number, applyAll: boolean) => void;
  /** NEW: zoomMoments from AI analysis for Auto Zoom */
  zoomMoments?: { timestamp: number; word: string; type: string }[];
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
  value, min, max, step = 1, label, unit = "", onChange,
}: {
  value: number; min: number; max: number; step?: number; label: string; unit?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: TEXT_SECONDARY }}>
        <span>{label}</span>
        <span style={{ color: ACCENT, fontWeight: 600 }}>
          {typeof step === "number" && step < 1 ? value.toFixed(2) : value}{unit}
        </span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)`, transition: "width 0.1s" }} />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", marginTop: -6, opacity: 0, height: 18, cursor: "pointer", position: "relative", zIndex: 2 }}
      />
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: TEXT_SECONDARY, userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? ACCENT : "rgba(255,255,255,0.12)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
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
  onFilterChange,
  onZoomChange,
  onTextOverlay,
  onEmojiOverlay,
  onTransitionSelect,
  zoomMoments,
}: EffectsEngineProps) {
  const [activeTab, setActiveTab] = useState<TabId>("filters");
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  // ─── Filter state (30 filters) ─────────
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // ─── Color state ────────────────────────
  const [activeColorPreset, setActiveColorPreset] = useState("original");
  const [customBrightness, setCustomBrightness] = useState(100);
  const [customContrast, setCustomContrast] = useState(100);
  const [customSaturation, setCustomSaturation] = useState(100);
  const [customHue, setCustomHue] = useState(0);
  const [customTemperature, setCustomTemperature] = useState(0);

  // ─── Zoom state ─────────────────────────
  const [activeZoomId, setActiveZoomId] = useState<string | null>(null);
  const [autoZoomEmphasis, setAutoZoomEmphasis] = useState(false);
  const [autoZoomMsg, setAutoZoomMsg] = useState<string | null>(null);

  // ─── Text state ─────────────────────────
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [editingText, setEditingText] = useState<TextOverlay | null>(null);

  // ─── Emoji state ────────────────────────
  const [emojiOverlays, setEmojiOverlays] = useState<EmojiOverlay[]>([]);
  const [emojiSearch, setEmojiSearch] = useState("");

  // ─── Transition state ──────────────────
  const [selectedTransition, setSelectedTransition] = useState("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [applyToAll, setApplyToAll] = useState(false);

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

  // FILTER click handler
  const handleFilterClick = useCallback(
    (filter: FilterPreset) => {
      if (activeFilterId === filter.id) {
        // Deselect
        setActiveFilterId(null);
        onFilterChange?.(null);
        onColorFilterChange?.("none");
      } else {
        setActiveFilterId(filter.id);
        onFilterChange?.({
          cssFilter: filter.cssFilter,
          overlayCSS: filter.overlayCSS,
          filterId: filter.id,
        });
        onColorFilterChange?.(filter.cssFilter !== "none" ? filter.cssFilter : "none");
        // Also add to timeline
        const kf: EffectKeyframe = {
          time: currentTime,
          type: filter.effectType,
          params: { cssFilter: filter.cssFilter, filterId: filter.id },
          duration: totalDuration - currentTime,
        };
        onAddEffect?.(kf);
      }
    },
    [activeFilterId, currentTime, totalDuration, onAddEffect, onFilterChange, onColorFilterChange]
  );

  // COLOR GRADING click handler
  const handleColorPreset = useCallback(
    (preset: ColorGradingPreset) => {
      if (preset.id === "original") {
        setActiveColorPreset("original");
        onColorFilterChange?.("none");
        onFilterChange?.(null);
        return;
      }
      setActiveColorPreset(preset.id);
      setActiveFilterId(null); // Clear any active filter
      onColorFilterChange?.(preset.cssFilter);
      onFilterChange?.({
        cssFilter: preset.cssFilter,
        filterId: `color-${preset.id}`,
      });
      const kf: EffectKeyframe = {
        time: 0,
        type: preset.effectType,
        params: { cssFilter: preset.cssFilter },
        duration: totalDuration,
      };
      onAddEffect?.(kf);
    },
    [totalDuration, onAddEffect, onColorFilterChange, onFilterChange]
  );

  // ZOOM click handler
  const handleZoomPreset = useCallback(
    (preset: ZoomPreset) => {
      if (activeZoomId === preset.id) {
        setActiveZoomId(null);
        onZoomChange?.(null);
      } else {
        setActiveZoomId(preset.id);
        onZoomChange?.({
          cssTransform: preset.cssTransform,
          cssTransition: preset.cssTransition,
          zoomId: preset.id,
        });
        const kf: EffectKeyframe = {
          time: currentTime,
          type: preset.effectType,
          params: { cssTransform: preset.cssTransform, cssTransition: preset.cssTransition },
          duration: preset.duration,
        };
        onAddEffect?.(kf);
      }
    },
    [activeZoomId, currentTime, onAddEffect, onZoomChange]
  );

  // AUTO ZOOM ON EMPHASIS handler
  const handleAutoZoom = useCallback(() => {
    if (!zoomMoments || zoomMoments.length === 0) {
      setAutoZoomMsg("No zoom moments found from AI analysis");
      setTimeout(() => setAutoZoomMsg(null), 3000);
      return;
    }

    // Max 3-4 zooms per minute
    const videoDurationMinutes = totalDuration / 60;
    const maxZooms = Math.max(1, Math.ceil(videoDurationMinutes * 3.5));
    const momentsToUse = zoomMoments.slice(0, maxZooms);

    const zoomTypeMap: Record<string, ZoomPreset> = {};
    ZOOM_PRESETS.forEach(p => { zoomTypeMap[p.id] = p; });

    let addedCount = 0;
    momentsToUse.forEach((zm) => {
      // Map AI moment type to a zoom preset
      let preset = ZOOM_PRESETS[0]; // default slow zoom in
      if (zm.type === "quick-emphasis" || zm.type === "emphasis") preset = ZOOM_PRESETS.find(p => p.id === "fast-punch") || ZOOM_PRESETS[1];
      else if (zm.type === "slow-zoom") preset = ZOOM_PRESETS[0];
      else if (zm.type === "zoom-out") preset = ZOOM_PRESETS.find(p => p.id === "zoom-out") || ZOOM_PRESETS[2];
      else if (zm.type === "zoom-pulse") preset = ZOOM_PRESETS.find(p => p.id === "breathe") || ZOOM_PRESETS[7];
      else if (zm.type === "dramatic") preset = ZOOM_PRESETS.find(p => p.id === "dramatic-push") || ZOOM_PRESETS[9];

      const kf: EffectKeyframe = {
        time: zm.timestamp,
        type: preset.effectType,
        params: { cssTransform: preset.cssTransform, cssTransition: preset.cssTransition, word: zm.word },
        duration: preset.duration,
      };
      onAddEffect?.(kf);
      addedCount++;
    });

    setAutoZoomMsg(`Added ${addedCount} zoom effect${addedCount !== 1 ? "s" : ""}`);
    setTimeout(() => setAutoZoomMsg(null), 3000);
  }, [zoomMoments, totalDuration, onAddEffect]);

  const handleApplyCustomColor = useCallback(() => {
    onColorFilterChange?.(customCssFilter);
    onFilterChange?.({
      cssFilter: customCssFilter,
      filterId: "custom-color",
    });
  }, [customCssFilter, onColorFilterChange, onFilterChange]);

  // TEXT handlers
  const handleAddText = useCallback(() => {
    const newText: TextOverlay = {
      id: uid("txt"), text: "Your text here", font: "Inter", size: 32, color: "#ffffff",
      x: 50, y: 50, animation: "fade-in", startTime: currentTime, duration: 3, isLowerThird: false,
    };
    setTextOverlays((prev) => [...prev, newText]);
    setEditingText(newText);
    const kf: EffectKeyframe = {
      time: currentTime, type: "text-overlay",
      params: { text: "Your text here", font: "Inter", size: 32, color: "#ffffff", x: 50, y: 50, animation: "fade-in" },
      duration: 3,
    };
    onAddEffect?.(kf);
  }, [currentTime, onAddEffect]);

  const handleAddLowerThird = useCallback(() => {
    const lt: TextOverlay = {
      id: uid("lt"), text: "Name", subtitle: "Title / Role", font: "Montserrat", size: 24, color: "#ffffff",
      x: 10, y: 80, animation: "slide-up", startTime: currentTime, duration: 4, isLowerThird: true,
    };
    setTextOverlays((prev) => [...prev, lt]);
    setEditingText(lt);
    const kf: EffectKeyframe = {
      time: currentTime, type: "lower-third",
      params: { text: "Name", subtitle: "Title / Role", font: "Montserrat", size: 24 },
      duration: 4,
    };
    onAddEffect?.(kf);
  }, [currentTime, onAddEffect]);

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
      const eo: EmojiOverlay = { id: uid("emj"), emoji, x: 50, y: 50, size: 48, animation: "pop", startTime: currentTime, duration: 2 };
      setEmojiOverlays((prev) => [...prev, eo]);
      onEmojiOverlay?.(eo);
      const kf: EffectKeyframe = { time: currentTime, type: "emoji", params: { emoji, x: 50, y: 50, size: 48, animation: "pop" }, duration: 2 };
      onAddEffect?.(kf);
    },
    [currentTime, onEmojiOverlay, onAddEffect]
  );

  const handleTransition = useCallback(
    (def: TransitionDef) => {
      setSelectedTransition(def.id);
      onTransitionSelect?.(def.effectType, transitionDuration, applyToAll);
      const kf: EffectKeyframe = { time: currentTime, type: def.effectType, params: { applyToAll }, duration: transitionDuration };
      onAddEffect?.(kf);
    },
    [currentTime, transitionDuration, applyToAll, onTransitionSelect, onAddEffect]
  );

  // ─── Render helpers ───────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case "zoom": return renderZoomTab();
      case "color": return renderColorTab();
      case "filters": return renderFiltersTab();
      case "text": return renderTextTab();
      case "emoji": return renderEmojiTab();
      case "transitions": return renderTransitionsTab();
    }
  };

  // ─── FILTERS TAB (30 filters) ─────────

  const renderFiltersTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel label="Filters (30)" />
      {/* Active filter indicator */}
      {activeFilterId && (
        <div style={{
          ...glass(0.1), padding: "8px 12px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderColor: `${ACCENT}44`,
        }}>
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>
            ✨ Active: {FILTER_PRESETS.find(f => f.id === activeFilterId)?.label}
          </span>
          <button
            onClick={() => { setActiveFilterId(null); onFilterChange?.(null); onColorFilterChange?.("none"); }}
            style={{ ...btnBase, fontSize: 11, color: "#ef4444", padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.1)" }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {FILTER_PRESETS.map((f) => {
          const isActive = activeFilterId === f.id;
          const isHovered = hoveredPreset === `filter-${f.id}`;
          return (
            <button
              key={f.id}
              onClick={() => handleFilterClick(f)}
              onMouseEnter={() => setHoveredPreset(`filter-${f.id}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...glass(isActive ? 0.14 : isHovered ? 0.1 : 0.04),
                padding: "8px 6px",
                cursor: "pointer",
                textAlign: "center",
                border: isActive ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                transition: "all 0.2s ease",
                transform: isHovered ? "scale(1.05)" : "scale(1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Filter preview swatch */}
              <div style={{
                width: "100%", height: 32, borderRadius: 6, marginBottom: 4,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                filter: f.cssFilter !== "none" ? f.cssFilter : undefined,
                position: "relative", overflow: "hidden",
              }}>
                {/* Overlay preview for overlay-type filters */}
                {f.needsOverlay && f.overlayCSS && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: 6, ...f.overlayCSS }} />
                )}
              </div>
              <span style={{ fontSize: 14, display: "block" }}>{f.icon}</span>
              <div style={{ fontSize: 10, fontWeight: 600, color: isActive ? ACCENT : TEXT_PRIMARY, marginTop: 2, lineHeight: 1.2 }}>
                {f.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── ZOOM TAB (10 zoom presets + auto zoom) ───────

  const renderZoomTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Zoom Presets (10)" />
      {/* Active zoom */}
      {activeZoomId && (
        <div style={{
          ...glass(0.1), padding: "8px 12px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderColor: `${ACCENT}44`,
        }}>
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>
            🔍 Active: {ZOOM_PRESETS.find(z => z.id === activeZoomId)?.label}
          </span>
          <button
            onClick={() => { setActiveZoomId(null); onZoomChange?.(null); }}
            style={{ ...btnBase, fontSize: 11, color: "#ef4444", padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.1)" }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {ZOOM_PRESETS.map((p) => {
          const isActive = activeZoomId === p.id;
          const isHovered = hoveredPreset === `zoom-${p.id}`;
          return (
            <button
              key={p.id}
              onClick={() => handleZoomPreset(p)}
              onMouseEnter={() => setHoveredPreset(`zoom-${p.id}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...glass(isActive ? 0.14 : isHovered ? 0.1 : 0.06),
                padding: "12px 10px", cursor: "pointer", textAlign: "left",
                border: isActive ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                transition: "all 0.25s ease",
                transform: isHovered ? "scale(1.03)" : "scale(1)",
                position: "relative", overflow: "hidden",
              }}
            >
              {isHovered && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle at center, ${ACCENT}15, transparent 70%)`,
                  animation: "zoomPulsePreview 1s ease-in-out infinite",
                }} />
              )}
              <div style={{ position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? ACCENT : TEXT_PRIMARY, marginTop: 4 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{p.description}</div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>⏱ {p.duration}s</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Auto Zoom on Emphasis */}
      <SectionLabel label="Auto Zoom (AI)" />
      <div style={{ ...glass(), padding: 14 }}>
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: "0 0 10px", lineHeight: 1.5 }}>
          AI analysed emphasis moments from your transcript. Click to add zoom effects on key words automatically.
        </p>
        {zoomMoments && zoomMoments.length > 0 && (
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: "0 0 8px" }}>
            Found <span style={{ color: ACCENT, fontWeight: 700 }}>{zoomMoments.length}</span> emphasis moment{zoomMoments.length !== 1 ? "s" : ""}
          </p>
        )}
        <button
          onClick={handleAutoZoom}
          style={{
            ...btnBase, width: "100%", padding: "10px 0", borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            color: "#fff", fontWeight: 600, fontSize: 13,
          }}
        >
          🎯 Auto Zoom on Emphasis
        </button>
        {autoZoomMsg && (
          <div style={{
            marginTop: 8, padding: "6px 10px", borderRadius: 6,
            background: autoZoomMsg.startsWith("Added") ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: autoZoomMsg.startsWith("Added") ? "#22c55e" : "#ef4444",
            fontSize: 12, fontWeight: 600, textAlign: "center",
          }}>
            {autoZoomMsg}
          </div>
        )}
      </div>
    </div>
  );

  // ─── COLOR TAB (22 color grading presets + custom) ─

  const renderColorTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Color Grading Presets (22)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {COLOR_GRADING_PRESETS.map((p) => {
          const isActive = activeColorPreset === p.id;
          const isHovered = hoveredPreset === `color-${p.id}`;
          return (
            <button
              key={p.id}
              onClick={() => handleColorPreset(p)}
              onMouseEnter={() => setHoveredPreset(`color-${p.id}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...btnBase, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: 6, borderRadius: 10,
                border: isActive ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                transition: "all 0.2s ease",
                transform: isHovered ? "scale(1.08)" : "scale(1)",
              }}
            >
              <div style={{
                width: "100%", aspectRatio: "16/9", borderRadius: 6,
                background: p.thumbnail,
                filter: p.cssFilter !== "none" ? p.cssFilter : undefined,
                transition: "transform 0.3s ease",
                transform: isHovered ? "scale(1.1)" : "scale(1)",
              }} />
              <span style={{ fontSize: 9, color: isActive ? ACCENT : TEXT_MUTED, fontWeight: 600 }}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom sliders */}
      <SectionLabel label="Custom Adjustment" />
      <div style={{ ...glass(), padding: 14 }}>
        <Slider label="Brightness" value={customBrightness} min={20} max={200} unit="%" onChange={setCustomBrightness} />
        <Slider label="Contrast" value={customContrast} min={20} max={200} unit="%" onChange={setCustomContrast} />
        <Slider label="Saturation" value={customSaturation} min={0} max={200} unit="%" onChange={setCustomSaturation} />
        <Slider label="Hue Rotate" value={customHue} min={-180} max={180} unit="°" onChange={setCustomHue} />
        <Slider label="Temperature" value={customTemperature} min={-50} max={50} onChange={setCustomTemperature} />

        {/* Live preview */}
        <div style={{
          width: "100%", height: 48, borderRadius: 8,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          filter: customCssFilter, marginTop: 6, marginBottom: 8,
        }} />

        <button
          onClick={handleApplyCustomColor}
          style={{
            ...btnBase, width: "100%", padding: "8px 0", borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            color: "#fff", fontWeight: 600, fontSize: 13,
          }}
        >
          Apply Custom Color
        </button>
      </div>
    </div>
  );

  // ─── TEXT TAB ──────────────────────────

  const renderTextTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Text Overlays" />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleAddText} style={{
          ...btnBase, flex: 1, padding: "10px 0", borderRadius: 8,
          background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`, color: "#fff", fontWeight: 600, fontSize: 13,
        }}>+ Add Text</button>
        <button onClick={handleAddLowerThird} style={{
          ...btnBase, flex: 1, padding: "10px 0", borderRadius: 8,
          background: "rgba(255,255,255,0.08)", color: TEXT_PRIMARY, fontWeight: 600, fontSize: 13, border: `1px solid ${BORDER}`,
        }}>+ Lower Third</button>
      </div>

      {textOverlays.map((t) => (
        <button key={t.id} onClick={() => setEditingText(t)} style={{
          ...glass(editingText?.id === t.id ? 0.12 : 0.06), padding: 10, cursor: "pointer", textAlign: "left",
          border: editingText?.id === t.id ? `1px solid ${ACCENT}66` : `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
            {t.isLowerThird ? "📋 " : "𝐓 "}{t.text}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>{t.font} · {t.animation} · {t.duration}s</div>
        </button>
      ))}

      {editingText && (
        <div style={{ ...glass(0.08), padding: 14 }}>
          <SectionLabel label={editingText.isLowerThird ? "Edit Lower Third" : "Edit Text"} />
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Text</label>
            <input
              value={editingText.text}
              onChange={(e) => handleUpdateEditingText({ text: e.target.value })}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,0.3)", color: TEXT_PRIMARY, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
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
                  width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.3)", color: TEXT_PRIMARY, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Font selector */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Font</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {GOOGLE_FONTS.map((font) => (
                <button key={font} onClick={() => handleUpdateEditingText({ font })} style={{
                  ...btnBase, fontSize: 11, padding: "4px 8px", borderRadius: 6,
                  background: editingText.font === font ? ACCENT : "rgba(255,255,255,0.06)",
                  color: editingText.font === font ? "#fff" : TEXT_MUTED, fontFamily: font, fontWeight: 500,
                }}>{font}</button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED }}>Color</label>
            <input type="color" value={editingText.color} onChange={(e) => handleUpdateEditingText({ color: e.target.value })} style={{ width: 32, height: 24, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
            <Slider label="Size" value={editingText.size} min={12} max={120} unit="px" onChange={(v) => handleUpdateEditingText({ size: v })} />
          </div>

          {/* Position */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><Slider label="X %" value={editingText.x} min={0} max={100} unit="%" onChange={(v) => handleUpdateEditingText({ x: v })} /></div>
            <div style={{ flex: 1 }}><Slider label="Y %" value={editingText.y} min={0} max={100} unit="%" onChange={(v) => handleUpdateEditingText({ y: v })} /></div>
          </div>

          {/* Animation */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: TEXT_MUTED, display: "block", marginBottom: 4 }}>Animation</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["none", "fade-in", "slide-up", "typewriter", "bounce"] as TextAnimation[]).map((anim) => (
                <button key={anim} onClick={() => handleUpdateEditingText({ animation: anim })} style={{
                  ...btnBase, fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  background: editingText.animation === anim ? ACCENT : "rgba(255,255,255,0.06)",
                  color: editingText.animation === anim ? "#fff" : TEXT_MUTED, fontWeight: 500, textTransform: "capitalize",
                }}>{anim}</button>
              ))}
            </div>
          </div>

          <Slider label="Duration" value={editingText.duration} min={0.5} max={30} step={0.5} unit="s" onChange={(v) => handleUpdateEditingText({ duration: v })} />

          {editingText.isLowerThird && (
            <div style={{
              marginTop: 8, padding: "10px 16px", borderRadius: 8,
              background: "rgba(0,0,0,0.6)", borderLeft: `3px solid ${ACCENT}`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, background: `linear-gradient(90deg, ${ACCENT}, transparent)`, width: "100%", animation: "slideInBar 0.6s ease-out" }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: editingText.font }}>{editingText.text}</div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: editingText.font }}>{editingText.subtitle}</div>
            </div>
          )}

          <button
            onClick={() => { setTextOverlays((prev) => prev.filter((t) => t.id !== editingText.id)); setEditingText(null); }}
            style={{
              ...btnBase, width: "100%", padding: "8px 0", borderRadius: 8,
              background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 600, fontSize: 13, marginTop: 8,
            }}
          >Delete Text</button>
        </div>
      )}
    </div>
  );

  // ─── EMOJI TAB ─────────────────────────

  const renderEmojiTab = () => {
    const filtered = emojiSearch ? POPULAR_EMOJI : POPULAR_EMOJI;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionLabel label="Emoji / Stickers" />
        <input
          placeholder="Search emoji..."
          value={emojiSearch}
          onChange={(e) => setEmojiSearch(e.target.value)}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}`,
            background: "rgba(0,0,0,0.3)", color: TEXT_PRIMARY, fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, maxHeight: 240, overflowY: "auto", ...glass(), padding: 8 }}>
          {filtered.map((em, i) => (
            <button
              key={i} onClick={() => handleAddEmoji(em)}
              onMouseEnter={() => setHoveredPreset(`em-${i}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...btnBase, fontSize: 22, padding: 4, borderRadius: 6,
                background: hoveredPreset === `em-${i}` ? "rgba(255,255,255,0.1)" : "transparent",
                transform: hoveredPreset === `em-${i}` ? "scale(1.3)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
              title={em}
            >{em}</button>
          ))}
        </div>

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
                <div style={{ display: "flex", gap: 3 }}>
                  {(["bounce", "rotate", "fade", "pop", "float"] as EmojiAnimation[]).map((anim) => (
                    <button key={anim} onClick={() => { setEmojiOverlays((prev) => prev.map((e) => (e.id === eo.id ? { ...e, animation: anim } : e))); }} style={{
                      ...btnBase, fontSize: 9, padding: "2px 6px", borderRadius: 4,
                      background: eo.animation === anim ? ACCENT : "rgba(255,255,255,0.06)",
                      color: eo.animation === anim ? "#fff" : TEXT_MUTED,
                    }}>{anim}</button>
                  ))}
                </div>
              </div>
            ))}
            {emojiOverlays.length > 0 && (
              <div style={{ ...glass(), padding: 12 }}>
                <Slider label="Duration" value={emojiOverlays[emojiOverlays.length - 1].duration} min={0.5} max={10} step={0.5} unit="s" onChange={(v) => { const lastId = emojiOverlays[emojiOverlays.length - 1].id; setEmojiOverlays((prev) => prev.map((e) => (e.id === lastId ? { ...e, duration: v } : e))); }} />
                <Slider label="Size" value={emojiOverlays[emojiOverlays.length - 1].size} min={16} max={128} unit="px" onChange={(v) => { const lastId = emojiOverlays[emojiOverlays.length - 1].id; setEmojiOverlays((prev) => prev.map((e) => (e.id === lastId ? { ...e, size: v } : e))); }} />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─── TRANSITIONS TAB (10 transitions) ─

  const renderTransitionsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label="Transitions (10)" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TRANSITION_DEFS.map((t) => {
          const isActive = selectedTransition === t.id;
          const isHovered = hoveredPreset === `tr-${t.id}`;
          return (
            <button
              key={t.id}
              onClick={() => handleTransition(t)}
              onMouseEnter={() => setHoveredPreset(`tr-${t.id}`)}
              onMouseLeave={() => setHoveredPreset(null)}
              style={{
                ...glass(isActive ? 0.14 : 0.06), padding: 10, cursor: "pointer", textAlign: "left",
                border: isActive ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                transition: "all 0.25s ease",
                transform: isHovered ? "scale(1.04)" : "scale(1)",
                position: "relative", overflow: "hidden",
              }}
            >
              <div style={{ width: "100%", height: 32, borderRadius: 6, background: t.previewGradient, marginBottom: 6, position: "relative", overflow: "hidden" }}>
                {isHovered && (
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(255,255,255,0.1)",
                    animation: t.id === "fade" ? "fadeInOut 1.5s infinite"
                      : t.id.includes("slide") ? "slidePreview 1s infinite"
                      : t.id === "zoom-transition" ? "zoomPulsePreview 1s infinite"
                      : t.id.includes("glitch") ? "glitchPreview 0.5s infinite"
                      : t.id === "wipe" ? "wipePreview 1.2s infinite"
                      : t.id === "spin" ? "spinPreview 1s infinite"
                      : "fadeInOut 1.5s infinite",
                  }} />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? ACCENT : TEXT_PRIMARY }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: TEXT_MUTED }}>{t.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Duration */}
      <div style={{ ...glass(), padding: 14 }}>
        <Slider
          label="Transition Duration" value={transitionDuration} min={0.3} max={2.0} step={0.1} unit="s"
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
          <button onClick={() => setApplyToAll(false)} style={{
            ...btnBase, flex: 1, padding: "8px 0", borderRadius: 8,
            background: !applyToAll ? ACCENT : "rgba(255,255,255,0.06)",
            color: !applyToAll ? "#fff" : TEXT_MUTED, fontSize: 12, fontWeight: 600,
          }}>Selected Clip</button>
          <button onClick={() => setApplyToAll(true)} style={{
            ...btnBase, flex: 1, padding: "8px 0", borderRadius: 8,
            background: applyToAll ? ACCENT : "rgba(255,255,255,0.06)",
            color: applyToAll ? "#fff" : TEXT_MUTED, fontSize: 12, fontWeight: 600,
          }}>All Clips</button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div style={{
      width: "100%", height: "100%", background: BG, color: TEXT_PRIMARY,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Inline keyframes */}
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
        @keyframes spinPreview {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideInBar {
          from { width: 0; }
          to { width: 100%; }
        }
        .fx-scroll::-webkit-scrollbar { width: 4px; }
        .fx-scroll::-webkit-scrollbar-track { background: transparent; }
        .fx-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
        .fx-scroll::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }
      `}</style>

      {/* Tab Bar */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${BORDER}`, padding: "0 4px",
        flexShrink: 0, background: "rgba(0,0,0,0.3)",
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...btnBase, flex: 1, padding: "10px 4px 8px", fontSize: 11, fontWeight: 600,
              color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_MUTED,
              position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "color 0.2s",
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div style={{
                position: "absolute", bottom: 0, left: "15%", right: "15%", height: 2, borderRadius: 2,
                background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)`,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="fx-scroll" style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {renderTabContent()}
      </div>
    </div>
  );
}

// ─── Section Label ──────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "#71717a",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2,
    }}>
      {label}
    </div>
  );
}
