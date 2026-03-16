"use client";
/* ═══════════════════════════════════════════════════════════
   SubtitlesEngine — 100 caption styles + reference clone
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { CaptionStyle } from "@/types/cineflow";

// ─── Keyframes (injected once) ───────────────────────────
const KEYFRAMES = `
@keyframes bounce-word {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fade-word {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes wave-text {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes typewriter-blink {
  0%, 100% { border-color: transparent; }
  50% { border-color: #fff; }
}
@keyframes neon-pulse {
  0%, 100% { text-shadow: 0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa; }
  50% { text-shadow: 0 0 4px #fff, 0 0 7px #fff, 0 0 13px #fff, 0 0 25px #0fa, 0 0 50px #0fa; }
}
@keyframes vhs-glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-2px, 1px); }
  40% { transform: translate(2px, -1px); }
  60% { transform: translate(-1px, 2px); }
  80% { transform: translate(1px, -2px); }
  100% { transform: translate(0); }
}
@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes slide-up {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes comic-pop {
  0% { transform: scale(0.5) rotate(-3deg); opacity: 0; }
  70% { transform: scale(1.05) rotate(1deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes handwrite-in {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes emoji-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}
@keyframes karaoke-sweep {
  0% { background-size: 0% 100%; }
  100% { background-size: 100% 100%; }
}
@keyframes shake-text {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-3px, -2px); }
  20% { transform: translate(3px, 2px); }
  30% { transform: translate(-3px, 1px); }
  40% { transform: translate(3px, -1px); }
  50% { transform: translate(-2px, 2px); }
  60% { transform: translate(2px, -2px); }
  70% { transform: translate(-1px, 3px); }
  80% { transform: translate(1px, -3px); }
  90% { transform: translate(-2px, 1px); }
}
@keyframes flip-in {
  0% { transform: rotateX(90deg); opacity: 0; }
  100% { transform: rotateX(0deg); opacity: 1; }
}
@keyframes zoom-word {
  0% { transform: scale(0.3); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fade-slide-left {
  0% { transform: translateX(-30px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes rainbow-shift {
  0% { color: #FF0000; }
  16% { color: #FF8800; }
  33% { color: #FFFF00; }
  50% { color: #00FF00; }
  66% { color: #0088FF; }
  83% { color: #8800FF; }
  100% { color: #FF0000; }
}
@keyframes smoke-in {
  0% { opacity: 0; filter: blur(12px); transform: translateY(10px); }
  100% { opacity: 1; filter: blur(0); transform: translateY(0); }
}
@keyframes fire-flicker {
  0%, 100% { text-shadow: 0 0 4px #ff4500, 0 0 11px #ff4500, 0 0 19px #ff4500, 0 0 40px #ff0000; }
  50% { text-shadow: 0 0 2px #ff4500, 0 0 5px #ff4500, 0 0 10px #ff4500, 0 0 20px #ff0000; }
}
@keyframes ice-shimmer {
  0%, 100% { text-shadow: 0 0 5px #b3e5fc, 0 0 10px #81d4fa, 0 0 20px #4fc3f7; }
  50% { text-shadow: 0 0 10px #e1f5fe, 0 0 20px #b3e5fc, 0 0 30px #81d4fa; }
}
@keyframes neon-pink-pulse {
  0%, 100% { text-shadow: 0 0 7px #ff69b4, 0 0 10px #ff69b4, 0 0 21px #ff69b4, 0 0 42px #ff1493; }
  50% { text-shadow: 0 0 4px #ff69b4, 0 0 7px #ff69b4, 0 0 13px #ff69b4, 0 0 25px #ff1493; }
}
@keyframes holographic-shift {
  0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
  50% { background-position: 100% 50%; filter: hue-rotate(180deg); }
  100% { background-position: 0% 50%; filter: hue-rotate(360deg); }
}
`;

// ─── 100 Caption Styles ──────────────────────────────────
const STYLES: CaptionStyle[] = [
  // ══════════════════════════════════════════════════════
  // CLASSIC (1-10)
  // ══════════════════════════════════════════════════════
  {
    id: "classic-clean-white",
    name: "Clean White",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 500,
    color: "#FFFFFF",
    textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
    stroke: "0.5px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "none",
    preview: "🔤",
  },
  {
    id: "classic-bold-impact",
    name: "Bold Impact",
    category: "classic",
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 38,
    fontWeight: 900,
    color: "#FFFFFF",
    textTransform: "uppercase",
    textShadow: "3px 3px 0px rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,0.8)",
    stroke: "2px #000",
    position: "bottom",
    animation: "none",
    preview: "💪",
  },
  {
    id: "classic-minimal",
    name: "Minimal",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 22,
    fontWeight: 300,
    color: "rgba(200,200,200,0.85)",
    textTransform: "lowercase",
    position: "bottom",
    animation: "fade",
    preview: "—",
  },
  {
    id: "classic-typewriter",
    name: "Typewriter",
    category: "classic",
    fontFamily: "'Courier New', monospace",
    fontSize: 26,
    fontWeight: 400,
    color: "#E8E8E8",
    backgroundColor: "rgba(0,0,0,0.5)",
    position: "bottom",
    animation: "typewriter",
    preview: "⌨️",
  },
  {
    id: "classic-elegant-serif",
    name: "Elegant Serif",
    category: "classic",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 400,
    color: "#F0EAD6",
    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
    position: "bottom",
    animation: "fade",
    preview: "✒️",
    customCSS: { fontStyle: "italic" },
  },
  {
    id: "classic-newspaper",
    name: "Newspaper",
    category: "classic",
    fontFamily: "'Times New Roman', serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
    position: "bottom",
    animation: "none",
    preview: "📰",
    customCSS: { letterSpacing: "0.2em" },
  },
  {
    id: "classic-handwritten",
    name: "Handwritten",
    category: "classic",
    fontFamily: "cursive",
    fontSize: 32,
    fontWeight: 400,
    color: "#FFF8DC",
    textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
    position: "center",
    animation: "none",
    preview: "✏️",
    customCSS: { transform: "rotate(-1.5deg)" },
  },
  {
    id: "classic-chalk",
    name: "Chalk",
    category: "classic",
    fontFamily: "'Arial', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#F5F0E1",
    textShadow: "2px 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(245,240,225,0.3)",
    position: "bottom",
    animation: "none",
    preview: "🖍️",
  },
  {
    id: "classic-neon-sign",
    name: "Neon Sign",
    category: "classic",
    fontFamily: "'Arial', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #bc13fe, 0 0 82px #bc13fe",
    position: "center",
    animation: "none",
    preview: "💡",
  },
  {
    id: "classic-cinema",
    name: "Classic Cinema",
    category: "classic",
    fontFamily: "'Palatino', 'Georgia', serif",
    fontSize: 26,
    fontWeight: 400,
    color: "#FFEFD5",
    textShadow: "0 2px 10px rgba(0,0,0,0.6)",
    position: "bottom",
    animation: "fade",
    preview: "🎬",
    customCSS: { letterSpacing: "0.08em" },
  },

  // ══════════════════════════════════════════════════════
  // CREATOR (11-25)
  // ══════════════════════════════════════════════════════
  {
    id: "creator-hormozi",
    name: "Hormozi",
    category: "creator",
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FFFFFF",
    highlightColor: "#FACC15",
    textTransform: "uppercase",
    textShadow: "3px 3px 0px rgba(0,0,0,0.9)",
    stroke: "2px black",
    position: "center",
    animation: "karaoke",
    preview: "🔥",
  },
  {
    id: "creator-mrbeast",
    name: "MrBeast",
    category: "creator",
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 42,
    fontWeight: 900,
    color: "#FFE500",
    textTransform: "uppercase",
    textShadow: "4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
    stroke: "3px #000000",
    position: "center",
    animation: "pop",
    preview: "🐻",
  },
  {
    id: "creator-ali-abdaal",
    name: "Ali Abdaal",
    category: "creator",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#DBEAFE",
    highlightColor: "#3B82F6",
    backgroundColor: "rgba(30,58,138,0.35)",
    position: "bottom",
    animation: "fade",
    preview: "📘",
  },
  {
    id: "creator-gary-vee",
    name: "Gary Vee",
    category: "creator",
    fontFamily: "'Impact', sans-serif",
    fontSize: 44,
    fontWeight: 900,
    color: "#EF4444",
    textTransform: "uppercase",
    textShadow: "3px 3px 0 #000, -1px -1px 0 #000",
    stroke: "2px #000",
    position: "center",
    animation: "pop",
    preview: "🗣️",
  },
  {
    id: "creator-mkbhd",
    name: "MKBHD",
    category: "creator",
    fontFamily: "'Helvetica', 'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 500,
    color: "#FFFFFF",
    highlightColor: "#EF4444",
    position: "bottom",
    animation: "none",
    preview: "📱",
  },
  {
    id: "creator-marques",
    name: "Marques",
    category: "creator",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 400,
    color: "#E0E0E0",
    textShadow: "0 1px 6px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "fade",
    preview: "⚙️",
  },
  {
    id: "creator-emma-chamberlain",
    name: "Emma Chamberlain",
    category: "creator",
    fontFamily: "'Arial', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#F9A8D4",
    highlightColor: "#EC4899",
    textTransform: "lowercase",
    backgroundColor: "rgba(236,72,153,0.12)",
    position: "bottom",
    animation: "bounce",
    preview: "☕",
  },
  {
    id: "creator-logan-paul",
    name: "Logan Paul",
    category: "creator",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 38,
    fontWeight: 900,
    color: "#FFFFFF",
    highlightColor: "#39FF14",
    textTransform: "uppercase",
    textShadow: "3px 3px 0 #000, -2px -2px 0 #000",
    stroke: "2px #000",
    position: "center",
    animation: "pop",
    preview: "🥊",
  },
  {
    id: "creator-pewdiepie",
    name: "PewDiePie",
    category: "creator",
    fontFamily: "'Impact', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FF0000",
    backgroundColor: "rgba(0,0,0,0.7)",
    textTransform: "uppercase",
    stroke: "2px #000",
    position: "center",
    animation: "pop",
    preview: "👊",
  },
  {
    id: "creator-casey-neistat",
    name: "Casey Neistat",
    category: "creator",
    fontFamily: "cursive",
    fontSize: 34,
    fontWeight: 700,
    color: "#FACC15",
    textShadow: "2px 2px 0px rgba(0,0,0,0.9)",
    position: "center",
    animation: "none",
    preview: "🎥",
  },
  {
    id: "creator-iman-gadzhi",
    name: "Iman Gadzhi",
    category: "creator",
    fontFamily: "'Georgia', serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#D4AF37",
    textShadow: "0 0 20px rgba(212,175,55,0.5), 2px 2px 4px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "fade",
    preview: "👑",
  },
  {
    id: "creator-dan-koe",
    name: "Dan Koe",
    category: "creator",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 300,
    color: "#94A3B8",
    position: "bottom",
    animation: "fade",
    preview: "🧠",
  },
  {
    id: "creator-linus-tech",
    name: "Linus Tech",
    category: "creator",
    fontFamily: "'Helvetica', 'Arial', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#FFFFFF",
    highlightColor: "#3B82F6",
    textShadow: "1px 1px 4px rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "none",
    preview: "💻",
  },
  {
    id: "creator-ryan-trahan",
    name: "Ryan Trahan",
    category: "creator",
    fontFamily: "'Arial', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "rgba(251,146,60,0.3)",
    highlightColor: "#FB923C",
    position: "center",
    animation: "bounce",
    preview: "🌈",
    customCSS: { borderRadius: "20px", padding: "6px 16px" },
  },
  {
    id: "creator-valuetainment",
    name: "Valuetainment",
    category: "creator",
    fontFamily: "'Georgia', serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#FFFFFF",
    highlightColor: "#DC2626",
    textTransform: "uppercase",
    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "none",
    preview: "💼",
  },

  // ══════════════════════════════════════════════════════
  // ANIMATED (26-40)
  // ══════════════════════════════════════════════════════
  {
    id: "animated-karaoke",
    name: "Karaoke",
    category: "animated",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "rgba(255,255,255,0.5)",
    highlightColor: "#FACC15",
    textTransform: "uppercase",
    position: "center",
    animation: "karaoke",
    preview: "🎤",
  },
  {
    id: "animated-typewriter-pop",
    name: "Typewriter Pop",
    category: "animated",
    fontFamily: "'Courier New', monospace",
    fontSize: 28,
    fontWeight: 500,
    color: "#22D3EE",
    backgroundColor: "rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "typewriter",
    preview: "⌨️",
  },
  {
    id: "animated-bounce-in",
    name: "Bounce In",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "2px 2px 0px rgba(139,92,246,0.8)",
    position: "center",
    animation: "bounce",
    preview: "⬆️",
  },
  {
    id: "animated-wave",
    name: "Wave",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#34D399",
    textShadow: "0 2px 8px rgba(52,211,153,0.4)",
    position: "center",
    animation: "wave",
    preview: "🌊",
  },
  {
    id: "animated-pop-scale",
    name: "Pop Scale",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 36,
    fontWeight: 800,
    color: "#A78BFA",
    textShadow: "0 0 12px rgba(167,139,250,0.6)",
    position: "center",
    animation: "pop",
    preview: "💥",
  },
  {
    id: "animated-fade-slide",
    name: "Fade Slide",
    category: "animated",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    color: "#FFFFFF",
    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
    position: "center",
    animation: "slide",
    preview: "➡️",
  },
  {
    id: "animated-glitch",
    name: "Glitch Text",
    category: "animated",
    fontFamily: "'Courier New', monospace",
    fontSize: 32,
    fontWeight: 700,
    color: "#FF6B6B",
    textShadow: "2px 0 #00FFFF, -2px 0 #FF00FF",
    position: "center",
    animation: "none",
    preview: "⚡",
  },
  {
    id: "animated-zoom-words",
    name: "Zoom Words",
    category: "animated",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 34,
    fontWeight: 900,
    color: "#FFFFFF",
    textShadow: "2px 2px 6px rgba(0,0,0,0.8)",
    position: "center",
    animation: "pop",
    preview: "🔍",
  },
  {
    id: "animated-flip",
    name: "Flip",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#E879F9",
    textShadow: "0 0 10px rgba(232,121,249,0.5)",
    position: "center",
    animation: "pop",
    preview: "🔄",
  },
  {
    id: "animated-shake",
    name: "Shake",
    category: "animated",
    fontFamily: "'Impact', sans-serif",
    fontSize: 38,
    fontWeight: 900,
    color: "#FF4444",
    textTransform: "uppercase",
    textShadow: "3px 3px 0 #000",
    stroke: "2px #000",
    position: "center",
    animation: "none",
    preview: "💢",
  },
  {
    id: "animated-neon-pulse",
    name: "Neon Pulse",
    category: "animated",
    fontFamily: "'Arial', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#00FF88",
    textShadow: "0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa",
    position: "center",
    animation: "none",
    preview: "💚",
  },
  {
    id: "animated-rainbow",
    name: "Rainbow",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FF0000",
    position: "center",
    animation: "none",
    preview: "🌈",
  },
  {
    id: "animated-smoke",
    name: "Smoke",
    category: "animated",
    fontFamily: "'Georgia', serif",
    fontSize: 30,
    fontWeight: 400,
    color: "#C8C8C8",
    textShadow: "0 0 20px rgba(200,200,200,0.4), 0 0 40px rgba(150,150,150,0.2)",
    position: "center",
    animation: "fade",
    preview: "💨",
  },
  {
    id: "animated-fire",
    name: "Fire Text",
    category: "animated",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FF4500",
    textShadow: "0 0 4px #ff4500, 0 0 11px #ff4500, 0 0 19px #ff4500, 0 0 40px #ff0000",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "🔥",
  },
  {
    id: "animated-ice",
    name: "Ice Text",
    category: "animated",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 32,
    fontWeight: 600,
    color: "#E1F5FE",
    textShadow: "0 0 5px #b3e5fc, 0 0 10px #81d4fa, 0 0 20px #4fc3f7, 0 0 40px #29b6f6",
    position: "center",
    animation: "none",
    preview: "❄️",
  },

  // ══════════════════════════════════════════════════════
  // STYLIZED (41-55)
  // ══════════════════════════════════════════════════════
  {
    id: "stylized-neon-glow",
    name: "Neon Glow",
    category: "stylized",
    fontFamily: "'Arial', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#FF00FF",
    textShadow: "0 0 7px #ff00ff, 0 0 10px #ff00ff, 0 0 21px #ff00ff, 0 0 42px #ff00ff, 0 0 82px #ff00ff",
    position: "center",
    animation: "none",
    preview: "✨",
  },
  {
    id: "stylized-cinematic",
    name: "Cinematic",
    category: "stylized",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 400,
    color: "#F5F5DC",
    textShadow: "0 2px 16px rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "fade",
    preview: "🎞️",
    customCSS: { letterSpacing: "0.15em", fontStyle: "italic" },
  },
  {
    id: "stylized-retro-vhs",
    name: "Retro VHS",
    category: "stylized",
    fontFamily: "'Courier New', monospace",
    fontSize: 30,
    fontWeight: 400,
    color: "#FF6B6B",
    textShadow: "2px 0 #00FFFF, -2px 0 #FF00FF, 0 0 8px rgba(255,107,107,0.6)",
    position: "bottom",
    animation: "none",
    preview: "📼",
  },
  {
    id: "stylized-comic-book",
    name: "Comic Book",
    category: "stylized",
    fontFamily: "cursive",
    fontSize: 34,
    fontWeight: 700,
    color: "#1A1A2E",
    backgroundColor: "#FFFFFF",
    textTransform: "uppercase",
    position: "center",
    animation: "pop",
    preview: "💬",
  },
  {
    id: "stylized-graffiti",
    name: "Graffiti",
    category: "stylized",
    fontFamily: "'Impact', sans-serif",
    fontSize: 40,
    fontWeight: 900,
    color: "#FF1493",
    textTransform: "uppercase",
    textShadow: "3px 3px 0 #000, 4px 4px 0 rgba(255,20,147,0.3)",
    stroke: "2px #000",
    position: "center",
    animation: "none",
    preview: "🎨",
    customCSS: { transform: "rotate(-3deg)" },
  },
  {
    id: "stylized-matrix",
    name: "Matrix",
    category: "stylized",
    fontFamily: "'Courier New', monospace",
    fontSize: 28,
    fontWeight: 700,
    color: "#00FF41",
    textShadow: "0 0 5px #00FF41, 0 0 10px #00FF41, 0 0 20px #003B00",
    backgroundColor: "rgba(0,0,0,0.8)",
    position: "center",
    animation: "none",
    preview: "🟢",
  },
  {
    id: "stylized-vintage-film",
    name: "Vintage Film",
    category: "stylized",
    fontFamily: "'Georgia', serif",
    fontSize: 26,
    fontWeight: 400,
    color: "#D2B48C",
    textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
    backgroundColor: "rgba(139,119,101,0.2)",
    position: "bottom",
    animation: "fade",
    preview: "📽️",
    customCSS: { borderRadius: "8px", padding: "6px 14px" },
  },
  {
    id: "stylized-cyberpunk",
    name: "Cyberpunk",
    category: "stylized",
    fontFamily: "'Arial', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FF00FF",
    textShadow: "0 0 10px #FF00FF, 0 0 20px #00FFFF, 2px 2px 0 #00FFFF",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "🤖",
  },
  {
    id: "stylized-art-deco",
    name: "Art Deco",
    category: "stylized",
    fontFamily: "'Palatino', serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#D4AF37",
    textShadow: "1px 1px 0 #B8860B, 2px 2px 0 rgba(0,0,0,0.5)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "🏛️",
    customCSS: { letterSpacing: "0.15em" },
  },
  {
    id: "stylized-pixel",
    name: "Pixel",
    category: "stylized",
    fontFamily: "'Courier New', monospace",
    fontSize: 24,
    fontWeight: 700,
    color: "#00FF00",
    backgroundColor: "rgba(0,0,0,0.9)",
    textShadow: "none",
    position: "bottom",
    animation: "none",
    preview: "👾",
    customCSS: { letterSpacing: "0.1em", padding: "6px 12px" },
  },
  {
    id: "stylized-stencil",
    name: "Stencil",
    category: "stylized",
    fontFamily: "'Impact', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FFFFFF",
    textTransform: "uppercase",
    stroke: "3px rgba(255,255,255,0.8)",
    textShadow: "2px 2px 0 rgba(0,0,0,0.4)",
    position: "center",
    animation: "none",
    preview: "✂️",
    customCSS: { letterSpacing: "0.12em" },
  },
  {
    id: "stylized-blueprint",
    name: "Blueprint",
    category: "stylized",
    fontFamily: "'Courier New', monospace",
    fontSize: 26,
    fontWeight: 500,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,71,171,0.8)",
    position: "bottom",
    animation: "none",
    preview: "📐",
    customCSS: { padding: "8px 16px", borderRadius: "4px" },
  },
  {
    id: "stylized-noir",
    name: "Noir",
    category: "stylized",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 400,
    color: "#FFFFFF",
    textShadow: "0 0 30px rgba(255,255,255,0.5), 0 2px 10px rgba(0,0,0,0.9)",
    position: "bottom",
    animation: "fade",
    preview: "🖤",
    customCSS: { fontStyle: "italic" },
  },
  {
    id: "stylized-polaroid",
    name: "Polaroid",
    category: "stylized",
    fontFamily: "'Arial', sans-serif",
    fontSize: 24,
    fontWeight: 500,
    color: "#333333",
    backgroundColor: "rgba(255,255,255,0.92)",
    position: "bottom",
    animation: "fade",
    preview: "📷",
    customCSS: { padding: "10px 20px", borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" },
  },
  {
    id: "stylized-watercolor",
    name: "Watercolor",
    category: "stylized",
    fontFamily: "cursive",
    fontSize: 30,
    fontWeight: 400,
    color: "#6B8E9B",
    textShadow: "0 0 15px rgba(107,142,155,0.4), 0 0 30px rgba(107,142,155,0.2)",
    position: "center",
    animation: "fade",
    preview: "🎨",
  },

  // ══════════════════════════════════════════════════════
  // SOCIAL (56-65)
  // ══════════════════════════════════════════════════════
  {
    id: "social-tiktok-classic",
    name: "TikTok Classic",
    category: "social",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    color: "#FFFFFF",
    textTransform: "uppercase",
    stroke: "2px #000",
    textShadow: "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
    position: "center",
    animation: "pop",
    preview: "🎵",
  },
  {
    id: "social-tiktok-trendy",
    name: "TikTok Trendy",
    category: "social",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "rgba(254,44,85,0.85)",
    position: "center",
    animation: "pop",
    preview: "🔴",
    customCSS: { borderRadius: "20px", padding: "6px 18px" },
  },
  {
    id: "social-instagram-story",
    name: "Instagram Story",
    category: "social",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    position: "bottom",
    animation: "slide",
    preview: "📸",
    customCSS: { borderRadius: "12px", padding: "8px 16px", background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)" },
  },
  {
    id: "social-youtube",
    name: "YouTube",
    category: "social",
    fontFamily: "'Arial', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    highlightColor: "#FF0000",
    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
    position: "center",
    animation: "karaoke",
    preview: "▶️",
  },
  {
    id: "social-twitter-x",
    name: "Twitter/X",
    category: "social",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 500,
    color: "#E7E9EA",
    backgroundColor: "rgba(29,155,240,0.2)",
    position: "bottom",
    animation: "fade",
    preview: "𝕏",
  },
  {
    id: "social-linkedin",
    name: "LinkedIn",
    category: "social",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,119,181,0.85)",
    position: "bottom",
    animation: "fade",
    preview: "💼",
    customCSS: { borderRadius: "8px", padding: "8px 16px" },
  },
  {
    id: "social-snapchat",
    name: "Snapchat",
    category: "social",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 32,
    fontWeight: 900,
    color: "#000000",
    backgroundColor: "rgba(255,252,0,0.9)",
    textTransform: "uppercase",
    position: "center",
    animation: "pop",
    preview: "👻",
    customCSS: { borderRadius: "4px", padding: "4px 12px" },
  },
  {
    id: "social-facebook",
    name: "Facebook",
    category: "social",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "rgba(24,119,242,0.8)",
    position: "bottom",
    animation: "fade",
    preview: "👍",
    customCSS: { borderRadius: "12px", padding: "6px 16px" },
  },
  {
    id: "social-reddit",
    name: "Reddit",
    category: "social",
    fontFamily: "monospace",
    fontSize: 24,
    fontWeight: 600,
    color: "#FFFFFF",
    highlightColor: "#FF4500",
    backgroundColor: "rgba(255,69,0,0.15)",
    position: "bottom",
    animation: "none",
    preview: "🤖",
  },
  {
    id: "social-twitch",
    name: "Twitch",
    category: "social",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 800,
    color: "#FFFFFF",
    backgroundColor: "rgba(145,70,255,0.8)",
    textTransform: "uppercase",
    position: "center",
    animation: "pop",
    preview: "🎮",
    customCSS: { borderRadius: "8px", padding: "6px 14px" },
  },

  // ══════════════════════════════════════════════════════
  // COLOR (66-80)
  // ══════════════════════════════════════════════════════
  {
    id: "color-fire-orange",
    name: "Fire Orange",
    category: "color",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 34,
    fontWeight: 900,
    color: "#FF6B35",
    textShadow: "0 0 10px rgba(255,107,53,0.6), 0 0 20px rgba(255,69,0,0.3)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "🔶",
  },
  {
    id: "color-ice-blue",
    name: "Ice Blue",
    category: "color",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    color: "#B3E5FC",
    textShadow: "0 0 8px rgba(179,229,252,0.5), 0 0 16px rgba(129,212,250,0.3)",
    position: "center",
    animation: "none",
    preview: "🧊",
  },
  {
    id: "color-ocean-deep",
    name: "Ocean Deep",
    category: "color",
    fontFamily: "'Georgia', serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#1565C0",
    textShadow: "0 0 10px rgba(21,101,192,0.5), 2px 2px 4px rgba(0,0,0,0.6)",
    backgroundColor: "rgba(13,71,161,0.2)",
    position: "bottom",
    animation: "fade",
    preview: "🌊",
  },
  {
    id: "color-sunset",
    name: "Sunset",
    category: "color",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#FF6F61",
    textShadow: "0 0 10px rgba(255,111,97,0.4), 0 0 20px rgba(255,183,77,0.3)",
    position: "center",
    animation: "none",
    preview: "🌅",
  },
  {
    id: "color-neon-pink",
    name: "Neon Pink",
    category: "color",
    fontFamily: "'Arial', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FF69B4",
    textShadow: "0 0 7px #FF69B4, 0 0 10px #FF69B4, 0 0 21px #FF69B4, 0 0 42px #FF1493",
    position: "center",
    animation: "none",
    preview: "💗",
  },
  {
    id: "color-electric-blue",
    name: "Electric Blue",
    category: "color",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    color: "#00BFFF",
    textShadow: "0 0 8px #00BFFF, 0 0 16px rgba(0,191,255,0.5)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "⚡",
  },
  {
    id: "color-gold-luxury",
    name: "Gold Luxury",
    category: "color",
    fontFamily: "'Palatino', serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#FFD700",
    textShadow: "1px 1px 0 #B8860B, 2px 2px 4px rgba(0,0,0,0.6)",
    position: "center",
    animation: "none",
    preview: "🥇",
    customCSS: { letterSpacing: "0.08em" },
  },
  {
    id: "color-forest-green",
    name: "Forest Green",
    category: "color",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#2E7D32",
    textShadow: "0 0 8px rgba(46,125,50,0.4), 1px 1px 3px rgba(0,0,0,0.5)",
    position: "bottom",
    animation: "fade",
    preview: "🌿",
  },
  {
    id: "color-purple-haze",
    name: "Purple Haze",
    category: "color",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#9C27B0",
    textShadow: "0 0 10px rgba(156,39,176,0.5), 0 0 20px rgba(156,39,176,0.3)",
    position: "center",
    animation: "none",
    preview: "💜",
  },
  {
    id: "color-rose-gold",
    name: "Rose Gold",
    category: "color",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 500,
    color: "#E8B4B8",
    textShadow: "0 0 8px rgba(232,180,184,0.4), 1px 1px 3px rgba(0,0,0,0.4)",
    position: "bottom",
    animation: "fade",
    preview: "🌹",
    customCSS: { fontStyle: "italic" },
  },
  {
    id: "color-coral",
    name: "Coral",
    category: "color",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    color: "#FF7F50",
    textShadow: "0 0 8px rgba(255,127,80,0.4), 1px 1px 2px rgba(0,0,0,0.4)",
    position: "center",
    animation: "none",
    preview: "🪸",
  },
  {
    id: "color-lavender",
    name: "Lavender",
    category: "color",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 400,
    color: "#B39DDB",
    textShadow: "0 0 8px rgba(179,157,219,0.4)",
    position: "bottom",
    animation: "fade",
    preview: "💐",
  },
  {
    id: "color-mint-fresh",
    name: "Mint Fresh",
    category: "color",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#00E676",
    textShadow: "0 0 8px rgba(0,230,118,0.4), 1px 1px 2px rgba(0,0,0,0.3)",
    position: "center",
    animation: "none",
    preview: "🍃",
  },
  {
    id: "color-crimson",
    name: "Crimson",
    category: "color",
    fontFamily: "'Impact', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#DC143C",
    textShadow: "2px 2px 0 #000, 0 0 10px rgba(220,20,60,0.5)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "❤️‍🔥",
  },
  {
    id: "color-amber",
    name: "Amber",
    category: "color",
    fontFamily: "'Georgia', serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#FFBF00",
    textShadow: "0 0 8px rgba(255,191,0,0.4), 1px 1px 3px rgba(0,0,0,0.5)",
    position: "bottom",
    animation: "fade",
    preview: "🍯",
  },

  // ══════════════════════════════════════════════════════
  // SPECIAL (81-90)
  // ══════════════════════════════════════════════════════
  {
    id: "special-outline-only",
    name: "Outline Only",
    category: "special",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "transparent",
    stroke: "2px #FFFFFF",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "◻️",
  },
  {
    id: "special-shadow-stack",
    name: "Shadow Stack",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "1px 1px 0 #8B5CF6, 2px 2px 0 #7C3AED, 3px 3px 0 #6D28D9, 4px 4px 0 #5B21B6, 5px 5px 0 rgba(0,0,0,0.3)",
    position: "center",
    animation: "none",
    preview: "📚",
  },
  {
    id: "special-split-color",
    name: "Split Color",
    category: "special",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 34,
    fontWeight: 900,
    color: "#00BFFF",
    textTransform: "uppercase",
    textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
    position: "center",
    animation: "none",
    preview: "🔀",
  },
  {
    id: "special-gradient-text",
    name: "Gradient Text",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    position: "center",
    animation: "none",
    preview: "🎨",
  },
  {
    id: "special-3d-depth",
    name: "3D Depth",
    category: "special",
    fontFamily: "'Impact', sans-serif",
    fontSize: 38,
    fontWeight: 900,
    color: "#FFFFFF",
    textShadow: "1px 1px 0 #ddd, 2px 2px 0 #ccc, 3px 3px 0 #bbb, 4px 4px 0 #aaa, 5px 5px 0 #999, 6px 6px 4px rgba(0,0,0,0.3)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "🧊",
  },
  {
    id: "special-glow-stack",
    name: "Glow Stack",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "0 0 10px #FF00FF, 0 0 20px #FF00FF, 0 0 40px #FF00FF, 0 0 80px #8B00FF",
    position: "center",
    animation: "none",
    preview: "🔮",
  },
  {
    id: "special-double-stroke",
    name: "Double Stroke",
    category: "special",
    fontFamily: "'Arial Black', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FFFFFF",
    stroke: "3px #FF0000",
    textShadow: "0 0 0 #000, 3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "⭕",
  },
  {
    id: "special-frosted-glass",
    name: "Frosted Glass",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.1)",
    position: "bottom",
    animation: "fade",
    preview: "🪟",
    customCSS: { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "12px", padding: "8px 18px", border: "1px solid rgba(255,255,255,0.15)" },
  },
  {
    id: "special-metallic",
    name: "Metallic",
    category: "special",
    fontFamily: "'Arial', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#C0C0C0",
    textShadow: "1px 1px 0 #fff, -1px -1px 0 #666, 2px 2px 4px rgba(0,0,0,0.5)",
    textTransform: "uppercase",
    position: "center",
    animation: "none",
    preview: "⚙️",
  },
  {
    id: "special-holographic",
    name: "Holographic",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    position: "center",
    animation: "none",
    preview: "🌈",
  },

  // ══════════════════════════════════════════════════════
  // MINIMAL (91-100)
  // ══════════════════════════════════════════════════════
  {
    id: "minimal-thin-light",
    name: "Thin Light",
    category: "minimal",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 26,
    fontWeight: 300,
    color: "rgba(255,255,255,0.8)",
    position: "bottom",
    animation: "fade",
    preview: "—",
  },
  {
    id: "minimal-mono",
    name: "Mono",
    category: "minimal",
    fontFamily: "monospace",
    fontSize: 24,
    fontWeight: 400,
    color: "#E0E0E0",
    position: "bottom",
    animation: "none",
    preview: ">_",
  },
  {
    id: "minimal-condensed",
    name: "Condensed",
    category: "minimal",
    fontFamily: "'Arial', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    position: "bottom",
    animation: "none",
    preview: "||",
    customCSS: { letterSpacing: "-0.03em" },
  },
  {
    id: "minimal-wide",
    name: "Wide",
    category: "minimal",
    fontFamily: "'Inter', sans-serif",
    fontSize: 22,
    fontWeight: 500,
    color: "#FFFFFF",
    textTransform: "uppercase",
    position: "bottom",
    animation: "none",
    preview: "W I D E",
    customCSS: { letterSpacing: "0.35em" },
  },
  {
    id: "minimal-small-caps",
    name: "Small Caps",
    category: "minimal",
    fontFamily: "'Georgia', serif",
    fontSize: 26,
    fontWeight: 500,
    color: "#D4D4D4",
    position: "bottom",
    animation: "none",
    preview: "Sc",
    customCSS: { fontVariant: "small-caps" },
  },
  {
    id: "minimal-all-lower",
    name: "All Lower",
    category: "minimal",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 400,
    color: "rgba(255,255,255,0.7)",
    textTransform: "lowercase",
    position: "bottom",
    animation: "fade",
    preview: "abc",
  },
  {
    id: "minimal-dots",
    name: "Dots",
    category: "minimal",
    fontFamily: "'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#FFFFFF",
    position: "bottom",
    animation: "none",
    preview: "···",
    customCSS: { textDecoration: "dotted underline", textUnderlineOffset: "4px" },
  },
  {
    id: "minimal-underline",
    name: "Underline",
    category: "minimal",
    fontFamily: "'Helvetica', sans-serif",
    fontSize: 26,
    fontWeight: 500,
    color: "#FFFFFF",
    position: "bottom",
    animation: "none",
    preview: "U̲",
    customCSS: { textDecoration: "underline", textUnderlineOffset: "4px", textDecorationThickness: "2px" },
  },
  {
    id: "minimal-bracket",
    name: "Bracket",
    category: "minimal",
    fontFamily: "monospace",
    fontSize: 24,
    fontWeight: 400,
    color: "rgba(255,255,255,0.75)",
    position: "bottom",
    animation: "none",
    preview: "[ ]",
  },
  {
    id: "minimal-invisible-ink",
    name: "Invisible Ink",
    category: "minimal",
    fontFamily: "'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "rgba(255,255,255,0.08)",
    position: "bottom",
    animation: "none",
    preview: "👁️",
  },
];

// ─── Category meta ───────────────────────────────────────
const CATEGORIES: { key: CaptionStyle["category"]; label: string; icon: string }[] = [
  { key: "classic", label: "Classic", icon: "Aa" },
  { key: "creator", label: "Creator", icon: "👤" },
  { key: "animated", label: "Animated", icon: "✦" },
  { key: "stylized", label: "Stylized", icon: "🎨" },
  { key: "social", label: "Social", icon: "📱" },
  { key: "color", label: "Color", icon: "🎨" },
  { key: "special", label: "Special", icon: "⚡" },
  { key: "minimal", label: "Minimal", icon: "·" },
];

// ─── Inline style builder per style ID ───────────────────
function buildPreviewStyle(s: CaptionStyle): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: `${Math.min(s.fontSize, 18)}px`,
    fontWeight: s.fontWeight,
    color: s.color,
    textShadow: s.textShadow,
    textTransform: s.textTransform as React.CSSProperties["textTransform"],
    WebkitTextStroke: s.stroke,
    lineHeight: 1.4,
    transition: "all 0.3s ease",
  };

  if (s.backgroundColor && s.id !== "stylized-comic-book") {
    base.backgroundColor = s.backgroundColor;
    base.padding = "4px 10px";
    base.borderRadius = "6px";
  }

  return base;
}

// ─── Per-style unique wrappers ───────────────────────────
// Returns extra wrapper styles and a render function for complex styles
function getStyleRenderer(
  s: CaptionStyle,
  text: string,
  isPreview: boolean
): React.ReactNode {
  const words = text.split(" ");
  const fontSize = isPreview ? Math.min(s.fontSize, 18) : s.fontSize;

  const baseFont: React.CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: s.fontWeight,
    color: s.color,
    textShadow: s.textShadow,
    textTransform: s.textTransform as React.CSSProperties["textTransform"],
    WebkitTextStroke: s.stroke,
    lineHeight: 1.4,
    ...(s.customCSS ?? {}),
  };

  switch (s.id) {
    // ══ CLASSIC ══

    // Handwritten: slightly tilted
    case "classic-handwritten":
      return (
        <span style={{ ...baseFont, transform: "rotate(-1.5deg)", display: "inline-block" }}>
          {text}
        </span>
      );

    // Neon Sign: glow pulse
    case "classic-neon-sign":
      return (
        <span style={{ ...baseFont, animation: "neon-pulse 2s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // Typewriter: blinking cursor
    case "classic-typewriter":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 12px",
            borderRadius: "4px",
            borderRight: "2px solid #E8E8E8",
            animation: "typewriter-blink 0.8s step-end infinite",
          }}
        >
          {text}
        </span>
      );

    // ══ CREATOR ══

    // Hormozi: yellow highlight on keyword
    case "creator-hormozi":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#FACC15" : s.color,
                backgroundColor: i === 1 ? "rgba(250,204,21,0.15)" : "transparent",
                padding: i === 1 ? "2px 4px" : undefined,
                borderRadius: "4px",
                marginRight: "6px",
                display: "inline-block",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // MrBeast: alternating colors
    case "creator-mrbeast": {
      const colors = ["#FFE500", "#FF4444", "#00FF88", "#00BFFF"];
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: colors[i % colors.length],
                marginRight: "6px",
                display: "inline-block",
                transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );
    }

    // Ali Abdaal: blue highlight
    case "creator-ali-abdaal":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 14px",
            borderRadius: "8px",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#3B82F6" : s.color,
                fontWeight: i === 1 ? 800 : s.fontWeight,
                marginRight: "5px",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Gary Vee: pop-in words
    case "creator-gary-vee":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `pop-in 0.4s ease ${i * 0.1}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // MKBHD: red accent word
    case "creator-mkbhd":
      return (
        <span style={{ ...baseFont, letterSpacing: "0.02em" }}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#EF4444" : s.color,
                marginRight: "5px",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Emma Chamberlain: pink bounce
    case "creator-emma-chamberlain":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 14px",
            borderRadius: "16px",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 0 ? s.highlightColor ?? "#EC4899" : s.color,
                display: "inline-block",
                marginRight: "5px",
                animation: `bounce-word 0.6s ease ${i * 0.1}s infinite`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Logan Paul: neon green highlight
    case "creator-logan-paul":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#39FF14" : s.color,
                display: "inline-block",
                marginRight: "6px",
                animation: `pop-in 0.35s ease ${i * 0.08}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Iman Gadzhi: luxury gold gradient
    case "creator-iman-gadzhi":
      return (
        <span
          style={{
            ...baseFont,
            background: "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 8px rgba(212,175,55,0.5))",
          }}
        >
          {text}
        </span>
      );

    // Linus Tech: blue accent
    case "creator-linus-tech":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#3B82F6" : s.color,
                marginRight: "5px",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Ryan Trahan: colorful bounce
    case "creator-ryan-trahan": {
      const tColors = ["#FB923C", "#34D399", "#60A5FA", "#F472B6"];
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            borderRadius: "20px",
            padding: "6px 16px",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: tColors[i % tColors.length],
                display: "inline-block",
                marginRight: "5px",
                animation: `bounce-word 0.5s ease ${i * 0.12}s infinite`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );
    }

    // Valuetainment: red highlight
    case "creator-valuetainment":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#DC2626" : s.color,
                fontWeight: i === 1 ? 900 : s.fontWeight,
                marginRight: "5px",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // ══ ANIMATED ══

    // Karaoke + YouTube: sweep highlight
    case "animated-karaoke":
    case "social-youtube":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                color: i === 1 ? s.highlightColor ?? "#FACC15" : s.color,
                fontWeight: i === 1 ? 900 : s.fontWeight,
                transform: i === 1 ? "scale(1.1)" : "scale(1)",
                transition: "all 0.2s ease",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Typewriter Pop
    case "animated-typewriter-pop":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 12px",
            borderRadius: "4px",
            borderRight: "2px solid #22D3EE",
            animation: "typewriter-blink 0.8s step-end infinite",
          }}
        >
          {text}
        </span>
      );

    // Bounce In
    case "animated-bounce-in":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `bounce-word 0.5s ease ${i * 0.12}s infinite`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Wave: letter-by-letter
    case "animated-wave":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span key={i} style={{ display: "inline-block", marginRight: "5px" }}>
              {w.split("").map((ch, ci) => (
                <span
                  key={ci}
                  style={{
                    display: "inline-block",
                    animation: `wave-text 1.2s ease ${(i * 4 + ci) * 0.07}s infinite`,
                  }}
                >
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </span>
      );

    // Pop Scale
    case "animated-pop-scale":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `pop-in 0.4s ease ${i * 0.1}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Fade Slide: from left
    case "animated-fade-slide":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "5px",
                animation: `fade-slide-left 0.5s ease ${i * 0.12}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Glitch Text: VHS-style glitch
    case "animated-glitch":
      return (
        <span
          style={{
            ...baseFont,
            animation: "vhs-glitch 0.3s ease infinite",
            position: "relative",
          }}
        >
          <span style={{ position: "absolute", left: "2px", top: "0", color: "#00FFFF", opacity: 0.5, zIndex: -1 }}>
            {text}
          </span>
          <span style={{ position: "absolute", left: "-2px", top: "0", color: "#FF00FF", opacity: 0.5, zIndex: -1 }}>
            {text}
          </span>
          {text}
        </span>
      );

    // Zoom Words
    case "animated-zoom-words":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `zoom-word 0.4s ease ${i * 0.1}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Flip: 3D flip
    case "animated-flip":
      return (
        <span style={{ ...baseFont, perspective: "600px" }}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `flip-in 0.5s ease ${i * 0.12}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Shake: aggressive
    case "animated-shake":
      return (
        <span style={{ ...baseFont, animation: "shake-text 0.4s ease infinite", display: "inline-block" }}>
          {text}
        </span>
      );

    // Neon Pulse
    case "animated-neon-pulse":
      return (
        <span style={{ ...baseFont, animation: "neon-pulse 2s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // Rainbow: color shift
    case "animated-rainbow":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "6px",
                animation: `rainbow-shift 3s linear ${i * 0.3}s infinite`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Smoke
    case "animated-smoke":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "5px",
                animation: `smoke-in 0.8s ease ${i * 0.15}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Fire Text
    case "animated-fire":
      return (
        <span style={{ ...baseFont, animation: "fire-flicker 1.5s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // Ice Text
    case "animated-ice":
      return (
        <span style={{ ...baseFont, animation: "ice-shimmer 2s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // ══ STYLIZED ══

    // Neon Glow: bright neon pulse
    case "stylized-neon-glow":
      return (
        <span style={{ ...baseFont, animation: "neon-pink-pulse 2s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // Cinematic: letterbox bars
    case "stylized-cinematic":
      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ width: "90%", height: "2px", backgroundColor: "rgba(245,245,220,0.3)", marginBottom: "6px" }} />
          <span style={{ ...baseFont, letterSpacing: "0.15em", fontStyle: "italic" }}>
            {text}
          </span>
          <div style={{ width: "90%", height: "2px", backgroundColor: "rgba(245,245,220,0.3)", marginTop: "6px" }} />
        </div>
      );

    // Retro VHS: glitch
    case "stylized-retro-vhs":
      return (
        <span style={{ ...baseFont, animation: "vhs-glitch 0.3s ease infinite", position: "relative" }}>
          <span style={{ position: "absolute", left: "2px", top: "0", color: "#00FFFF", opacity: 0.5, zIndex: -1 }}>{text}</span>
          <span style={{ position: "absolute", left: "-2px", top: "0", color: "#FF00FF", opacity: 0.5, zIndex: -1 }}>{text}</span>
          {text}
        </span>
      );

    // Comic Book: speech bubble
    case "stylized-comic-book":
      return (
        <div
          style={{
            ...baseFont,
            backgroundColor: "#FFFFFF",
            color: "#1A1A2E",
            padding: "10px 18px",
            borderRadius: "20px",
            border: "3px solid #1A1A2E",
            position: "relative",
            display: "inline-block",
            animation: "comic-pop 0.5s ease both",
            boxShadow: "4px 4px 0px #1A1A2E",
          }}
        >
          {text}
          <div
            style={{
              position: "absolute",
              bottom: "-10px",
              left: "20px",
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "10px solid #FFFFFF",
            }}
          />
        </div>
      );

    // Graffiti: tilted
    case "stylized-graffiti":
      return (
        <span style={{ ...baseFont, transform: "rotate(-3deg) skewX(-2deg)", display: "inline-block" }}>
          {text}
        </span>
      );

    // Matrix: digital rain feel
    case "stylized-matrix":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 12px",
            borderRadius: "4px",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "5px",
                animation: `fade-word 0.5s ease ${i * 0.15}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Cyberpunk: magenta+cyan
    case "stylized-cyberpunk":
      return (
        <span style={{ ...baseFont, position: "relative" }}>
          <span style={{ position: "absolute", left: "1px", top: "1px", color: "#00FFFF", opacity: 0.6, zIndex: -1 }}>{text}</span>
          {text}
        </span>
      );

    // ══ SOCIAL ══

    // TikTok Classic: pop words
    case "social-tiktok-classic":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "5px",
                animation: `pop-in 0.35s ease ${i * 0.08}s both`,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // TikTok Trendy: pill
    case "social-tiktok-trendy":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: "rgba(254,44,85,0.85)",
            borderRadius: "20px",
            padding: "6px 18px",
            animation: "pop-in 0.4s ease both",
          }}
        >
          {text}
        </span>
      );

    // Instagram Story: gradient bg
    case "social-instagram-story":
      return (
        <span
          style={{
            ...baseFont,
            background: "linear-gradient(45deg, #f09433, #dc2743, #bc1888)",
            borderRadius: "12px",
            padding: "8px 16px",
            animation: "slide-up 0.4s ease both",
          }}
        >
          {text}
        </span>
      );

    // Twitter/X: blue border left
    case "social-twitter-x":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 14px",
            borderRadius: "8px",
            borderLeft: "3px solid #1D9BF0",
          }}
        >
          {text}
        </span>
      );

    // LinkedIn: professional pill
    case "social-linkedin":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            borderRadius: "8px",
            padding: "8px 16px",
          }}
        >
          {text}
        </span>
      );

    // Snapchat: yellow bg
    case "social-snapchat":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            borderRadius: "4px",
            padding: "4px 12px",
            animation: "pop-in 0.3s ease both",
          }}
        >
          {text}
        </span>
      );

    // Facebook: blue rounded
    case "social-facebook":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            borderRadius: "12px",
            padding: "6px 16px",
          }}
        >
          {text}
        </span>
      );

    // Reddit: orange accent
    case "social-reddit":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 12px",
            borderRadius: "6px",
            borderLeft: "3px solid #FF4500",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 0 ? s.highlightColor ?? "#FF4500" : s.color,
                marginRight: "5px",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Twitch: purple pop
    case "social-twitch":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            borderRadius: "8px",
            padding: "6px 14px",
            animation: "pop-in 0.3s ease both",
          }}
        >
          {text}
        </span>
      );

    // ══ SPECIAL ══

    // Outline Only: transparent fill, white stroke
    case "special-outline-only":
      return (
        <span style={{ ...baseFont, color: "transparent", WebkitTextStroke: "2px #FFFFFF" }}>
          {text}
        </span>
      );

    // Split Color: first word blue, rest orange
    case "special-split-color":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i % 2 === 0 ? "#00BFFF" : "#FF6B35",
                marginRight: "6px",
                display: "inline-block",
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // Gradient Text: animated gradient fill
    case "special-gradient-text":
      return (
        <span
          style={{
            ...baseFont,
            background: "linear-gradient(90deg, #8B5CF6, #EC4899, #F59E0B, #10B981, #8B5CF6)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "gradient-flow 3s linear infinite",
          }}
        >
          {text}
        </span>
      );

    // Holographic: rainbow shimmer
    case "special-holographic":
      return (
        <span
          style={{
            ...baseFont,
            background: "linear-gradient(90deg, #FF0000, #FF8800, #FFFF00, #00FF00, #0088FF, #8800FF, #FF0000)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "holographic-shift 3s linear infinite",
          }}
        >
          {text}
        </span>
      );

    // Frosted Glass: blur bg
    case "special-frosted-glass":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "12px",
            padding: "8px 18px",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {text}
        </span>
      );

    // Metallic: silver
    case "special-metallic":
      return (
        <span
          style={{
            ...baseFont,
            background: "linear-gradient(180deg, #E8E8E8, #C0C0C0, #A0A0A0, #C0C0C0, #E8E8E8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.5))",
          }}
        >
          {text}
        </span>
      );

    // ══ MINIMAL ══

    // Bracket: wrap text in brackets
    case "minimal-bracket":
      return (
        <span style={baseFont}>
          [{text}]
        </span>
      );

    // Invisible Ink: very low opacity, visible on hover
    case "minimal-invisible-ink":
      return (
        <span
          style={{
            ...baseFont,
            color: "rgba(255,255,255,0.08)",
            transition: "color 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.08)")}
        >
          {text}
        </span>
      );

    // ── Default fallback (handles all simple styles) ──
    default:
      return (
        <span
          style={{
            ...baseFont,
            ...(s.backgroundColor && !s.customCSS?.padding
              ? {
                  backgroundColor: s.backgroundColor,
                  padding: "4px 10px",
                  borderRadius: "6px",
                }
              : {}),
          }}
        >
          {text}
        </span>
      );
  }
}

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════
interface SubtitlesEngineProps {
  onStyleSelect?: (style: CaptionStyle) => void;
  onPositionChange?: (position: "top" | "center" | "bottom") => void;
  onTranscriptEdit?: (text: string) => void;
  initialStyle?: CaptionStyle;
  initialPosition?: "top" | "center" | "bottom";
}

export default function SubtitlesEngine({
  onStyleSelect,
  onPositionChange,
  onTranscriptEdit,
  initialStyle,
  initialPosition = "bottom",
}: SubtitlesEngineProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialStyle?.id ?? "classic-clean-white"
  );
  const [position, setPosition] = useState<"top" | "center" | "bottom">(
    initialPosition
  );
  const [activeCategory, setActiveCategory] = useState<
    CaptionStyle["category"] | "all"
  >("all");
  const [captionText, setCaptionText] = useState("Ai powered editing");
  const [clonedStyle, setClonedStyle] = useState<CaptionStyle | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inject keyframes once
  useEffect(() => {
    const id = "subtitles-engine-keyframes";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = KEYFRAMES;
      document.head.appendChild(style);
    }
  }, []);

  // Google Fonts loader
  useEffect(() => {
    const fonts = [
      "Montserrat:wght@400;700;800;900",
      "Playfair+Display:wght@400;700",
      "Poppins:wght@400;600;700;800",
      "Nunito:wght@400;700;800",
      "Orbitron:wght@400;700",
      "VT323",
      "Bangers",
      "Caveat:wght@400;700",
      "Bebas+Neue",
      "Roboto:wght@400;700",
      "Inter:wght@400;500;600;700;800;900",
    ];
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${f}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }, []);

  const allStyles = clonedStyle ? [...STYLES, clonedStyle] : STYLES;
  const filteredStyles =
    activeCategory === "all"
      ? allStyles
      : allStyles.filter((s) => s.category === activeCategory);

  const selectedStyle =
    allStyles.find((s) => s.id === selectedId) ?? STYLES[0];

  const handleSelect = useCallback(
    (s: CaptionStyle) => {
      setSelectedId(s.id);
      onStyleSelect?.(s);
    },
    [onStyleSelect]
  );

  const handlePositionChange = useCallback(
    (p: "top" | "center" | "bottom") => {
      setPosition(p);
      onPositionChange?.(p);
    },
    [onPositionChange]
  );

  // Reference upload → style-clone
  const handleReferenceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsCloning(true);
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/style-clone", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Style clone failed");
        const data = await res.json();
        const style: CaptionStyle = {
          ...data.style,
          id: "cloned-style",
          name: "Cloned Style",
          category: "special" as const,
          preview: captionText,
        };
        setClonedStyle(style);
        setSelectedId(style.id);
        onStyleSelect?.(style);
      } catch (err) {
        console.error("Reference upload error:", err);
      } finally {
        setIsCloning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [captionText, onStyleSelect]
  );

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#09090b",
        color: "#FFFFFF",
        padding: "24px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ color: "#8B5CF6" }}>◉</span> Subtitles Engine
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.5)",
              margin: "4px 0 0",
            }}
          >
            {allStyles.length} styles • select to preview
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Position selector */}
          {(["top", "center", "bottom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePositionChange(p)}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid",
                borderColor:
                  position === p ? "#8B5CF6" : "rgba(255,255,255,0.1)",
                background:
                  position === p ? "rgba(139,92,246,0.15)" : "transparent",
                color:
                  position === p ? "#8B5CF6" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s ease",
              }}
            >
              {p}
            </button>
          ))}

          {/* Reference upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isCloning}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "1px solid rgba(139,92,246,0.4)",
              background: "rgba(139,92,246,0.1)",
              color: "#A78BFA",
              cursor: isCloning ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.2s ease",
            }}
          >
            {isCloning ? "⏳ Cloning..." : "📷 Clone Reference"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReferenceUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* ── Caption Text Editor ── */}
      <div
        style={{
          marginBottom: "20px",
          padding: "12px 16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
          Caption:
        </span>
        {isEditingCaption ? (
          <input
            autoFocus
            value={captionText}
            onChange={(e) => {
              setCaptionText(e.target.value);
              onTranscriptEdit?.(e.target.value);
            }}
            onBlur={() => setIsEditingCaption(false)}
            onKeyDown={(e) => e.key === "Enter" && setIsEditingCaption(false)}
            style={{
              flex: 1,
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#FFFFFF",
              fontSize: "14px",
              outline: "none",
              fontFamily: "'Inter', sans-serif",
            }}
          />
        ) : (
          <span
            onClick={() => setIsEditingCaption(true)}
            style={{
              flex: 1,
              fontSize: "14px",
              color: "rgba(255,255,255,0.8)",
              cursor: "text",
              padding: "6px 10px",
              borderRadius: "6px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {captionText}
            <span style={{ marginLeft: "8px", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
              click to edit
            </span>
          </span>
        )}
      </div>

      {/* ── Category tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "4px",
        }}
      >
        <button
          onClick={() => setActiveCategory("all")}
          style={{
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "1px solid",
            borderColor:
              activeCategory === "all" ? "#8B5CF6" : "rgba(255,255,255,0.08)",
            background:
              activeCategory === "all" ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
            color:
              activeCategory === "all" ? "#8B5CF6" : "rgba(255,255,255,0.5)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
        >
          All ({allStyles.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = allStyles.filter((s) => s.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid",
                borderColor:
                  activeCategory === cat.key
                    ? "#8B5CF6"
                    : "rgba(255,255,255,0.08)",
                background:
                  activeCategory === cat.key
                    ? "rgba(139,92,246,0.15)"
                    : "rgba(255,255,255,0.03)",
                color:
                  activeCategory === cat.key
                    ? "#8B5CF6"
                    : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Style Grid (6 columns) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {filteredStyles.map((s) => {
          const isSelected = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              style={{
                position: "relative",
                background: isSelected
                  ? "rgba(139,92,246,0.12)"
                  : "rgba(255,255,255,0.03)",
                border: isSelected
                  ? "1.5px solid #8B5CF6"
                  : "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                padding: "16px 10px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "110px",
                gap: "10px",
                transition: "all 0.25s ease",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                overflow: "hidden",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }
              }}
            >
              {/* Style preview */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  minHeight: "48px",
                }}
              >
                {getStyleRenderer(s, captionText, true)}
              </div>

              {/* Style name */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: isSelected ? "#A78BFA" : "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {s.name}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#8B5CF6",
                    boxShadow: "0 0 6px rgba(139,92,246,0.6)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected Style Preview (large) ── */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "16px",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          alignItems: position === "top"
            ? "center"
            : position === "center"
              ? "center"
              : "center",
          justifyContent: position === "top"
            ? "flex-start"
            : position === "center"
              ? "center"
              : "flex-end",
          minHeight: "200px",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          {getStyleRenderer(
            selectedStyle,
            captionText,
            false
          )}
        </div>

        {/* Position indicator label */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "12px",
            fontSize: "10px",
            color: "rgba(255,255,255,0.2)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Position: {position} • {selectedStyle.name}
        </div>
      </div>
    </div>
  );
}
