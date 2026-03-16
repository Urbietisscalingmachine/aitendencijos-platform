"use client";
/* ═══════════════════════════════════════════════════════════
   SubtitlesEngine — 30 caption styles + reference clone
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
`;

// ─── 30 Caption Styles ───────────────────────────────────
const STYLES: CaptionStyle[] = [
  // ══ CLASSIC 1-5 ══
  {
    id: "classic-default",
    name: "Default",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 500,
    color: "#FFFFFF",
    textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
    stroke: "0.5px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "classic-bold-white",
    name: "Bold White",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "2px 2px 8px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.5)",
    position: "bottom",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "classic-minimal",
    name: "Minimal",
    category: "classic",
    fontFamily: "'SF Pro Display', 'Inter', sans-serif",
    fontSize: 22,
    fontWeight: 400,
    color: "rgba(255,255,255,0.85)",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing",
  },
  {
    id: "classic-uppercase",
    name: "Uppercase",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "classic-lowercase",
    name: "Lowercase",
    category: "classic",
    fontFamily: "'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 400,
    color: "#E0E0E0",
    textTransform: "lowercase",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing",
  },

  // ══ CREATOR 6-12 ══
  {
    id: "creator-hormozi",
    name: "Hormozi",
    category: "creator",
    fontFamily: "'Montserrat', 'Inter', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#FFFFFF",
    highlightColor: "#FACC15",
    textTransform: "uppercase",
    textShadow: "3px 3px 0px rgba(0,0,0,0.9)",
    stroke: "2px black",
    position: "center",
    animation: "karaoke",
    preview: "Ai powered editing",
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
    preview: "Ai powered editing",
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
    preview: "Ai powered editing",
  },
  {
    id: "creator-gary-vee",
    name: "Gary Vee",
    category: "creator",
    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
    fontSize: 44,
    fontWeight: 900,
    color: "#EF4444",
    textTransform: "uppercase",
    textShadow: "3px 3px 0 #000, -1px -1px 0 #000",
    stroke: "2px #000",
    position: "center",
    animation: "pop",
    preview: "Ai powered editing",
  },
  {
    id: "creator-iman-gadzhi",
    name: "Iman Gadzhi",
    category: "creator",
    fontFamily: "'Playfair Display', 'Georgia', serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#D4AF37",
    textShadow: "0 0 20px rgba(212,175,55,0.5), 2px 2px 4px rgba(0,0,0,0.8)",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing",
  },
  {
    id: "creator-alex-earle",
    name: "Alex Earle",
    category: "creator",
    fontFamily: "'Poppins', 'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#F9A8D4",
    highlightColor: "#EC4899",
    backgroundColor: "rgba(236,72,153,0.15)",
    textShadow: "0 0 10px rgba(236,72,153,0.4)",
    position: "bottom",
    animation: "bounce",
    preview: "Ai powered editing",
  },
  {
    id: "creator-mkbhd",
    name: "MKBHD",
    category: "creator",
    fontFamily: "'SF Pro Display', 'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#FFFFFF",
    highlightColor: "#EF4444",
    position: "bottom",
    animation: "none",
    preview: "Ai powered editing",
  },

  // ══ ANIMATED 13-18 ══
  {
    id: "animated-karaoke",
    name: "Karaoke",
    category: "animated",
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "rgba(255,255,255,0.5)",
    highlightColor: "#FACC15",
    textTransform: "uppercase",
    position: "center",
    animation: "karaoke",
    preview: "Ai powered editing",
  },
  {
    id: "animated-typewriter",
    name: "Typewriter",
    category: "animated",
    fontFamily: "'Courier New', 'Courier', monospace",
    fontSize: 28,
    fontWeight: 500,
    color: "#22D3EE",
    backgroundColor: "rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "typewriter",
    preview: "Ai powered editing",
  },
  {
    id: "animated-bounce",
    name: "Bounce",
    category: "animated",
    fontFamily: "'Nunito', 'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "2px 2px 0px rgba(139,92,246,0.8)",
    position: "center",
    animation: "bounce",
    preview: "Ai powered editing",
  },
  {
    id: "animated-fade-word",
    name: "Fade Word",
    category: "animated",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    color: "#FFFFFF",
    position: "center",
    animation: "word-fade",
    preview: "Ai powered editing",
  },
  {
    id: "animated-pop-in",
    name: "Pop-in",
    category: "animated",
    fontFamily: "'Poppins', sans-serif",
    fontSize: 36,
    fontWeight: 800,
    color: "#A78BFA",
    textShadow: "0 0 12px rgba(167,139,250,0.6)",
    position: "center",
    animation: "pop",
    preview: "Ai powered editing",
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
    preview: "Ai powered editing",
  },

  // ══ STYLIZED 19-24 ══
  {
    id: "stylized-neon",
    name: "Neon Glow",
    category: "stylized",
    fontFamily: "'Orbitron', 'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#00FF88",
    textShadow:
      "0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa, 0 0 92px #0fa",
    position: "center",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "stylized-cinematic",
    name: "Cinematic",
    category: "stylized",
    fontFamily: "'Playfair Display', 'Georgia', serif",
    fontSize: 28,
    fontWeight: 400,
    color: "#F5F5DC",
    textShadow: "0 2px 16px rgba(0,0,0,0.7)",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing",
  },
  {
    id: "stylized-retro-vhs",
    name: "Retro VHS",
    category: "stylized",
    fontFamily: "'VT323', 'Courier New', monospace",
    fontSize: 30,
    fontWeight: 400,
    color: "#FF6B6B",
    textShadow:
      "2px 0 #00FFFF, -2px 0 #FF00FF, 0 0 8px rgba(255,107,107,0.6)",
    position: "bottom",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "stylized-comic",
    name: "Comic Book",
    category: "stylized",
    fontFamily: "'Bangers', 'Comic Sans MS', cursive",
    fontSize: 34,
    fontWeight: 400,
    color: "#1A1A2E",
    backgroundColor: "#FFFFFF",
    textTransform: "uppercase",
    position: "center",
    animation: "pop",
    preview: "Ai powered editing",
  },
  {
    id: "stylized-handwritten",
    name: "Handwritten",
    category: "stylized",
    fontFamily: "'Caveat', 'Segoe Script', cursive",
    fontSize: 36,
    fontWeight: 700,
    color: "#FBBF24",
    textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
    position: "center",
    animation: "none",
    preview: "Ai powered editing",
  },
  {
    id: "stylized-gradient-flow",
    name: "Gradient Flow",
    category: "stylized",
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 34,
    fontWeight: 800,
    color: "#FFFFFF",
    position: "center",
    animation: "none",
    preview: "Ai powered editing",
  },

  // ══ SOCIAL 25-28 ══
  {
    id: "social-tiktok",
    name: "TikTok Native",
    category: "social",
    fontFamily: "'Proxima Nova', 'Inter', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    color: "#FFFFFF",
    textTransform: "uppercase",
    stroke: "2px #000",
    textShadow: "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
    position: "center",
    animation: "pop",
    preview: "Ai powered editing",
  },
  {
    id: "social-reels",
    name: "Instagram Reels",
    category: "social",
    fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.4)",
    position: "bottom",
    animation: "slide",
    preview: "Ai powered editing",
  },
  {
    id: "social-youtube-shorts",
    name: "YouTube Shorts",
    category: "social",
    fontFamily: "'Roboto', 'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    highlightColor: "#FF0000",
    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
    position: "center",
    animation: "karaoke",
    preview: "Ai powered editing",
  },
  {
    id: "social-twitter",
    name: "Twitter/X Clip",
    category: "social",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 500,
    color: "#E7E9EA",
    backgroundColor: "rgba(29,155,240,0.2)",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing",
  },

  // ══ SPECIAL 29-30 ══
  {
    id: "special-emoji",
    name: "Emoji Captions",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "2px 2px 6px rgba(0,0,0,0.8)",
    position: "center",
    animation: "bounce",
    preview: "Ai ✨ powered 🚀 editing 🎬",
  },
  {
    id: "special-bilingual",
    name: "Bilingual",
    category: "special",
    fontFamily: "'Inter', sans-serif",
    fontSize: 24,
    fontWeight: 600,
    color: "#FFFFFF",
    highlightColor: "#A78BFA",
    position: "bottom",
    animation: "fade",
    preview: "Ai powered editing\nAI redagavimas",
  },
];

// ─── Category meta ───────────────────────────────────────
const CATEGORIES: { key: CaptionStyle["category"]; label: string; icon: string }[] = [
  { key: "classic", label: "Classic", icon: "Aa" },
  { key: "creator", label: "Creator", icon: "👤" },
  { key: "animated", label: "Animated", icon: "✦" },
  { key: "stylized", label: "Stylized", icon: "🎨" },
  { key: "social", label: "Social", icon: "📱" },
  { key: "special", label: "Special", icon: "⚡" },
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

  if (s.backgroundColor && s.id !== "stylized-comic") {
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
  };

  switch (s.id) {
    // ── Hormozi: yellow highlight on "powered" ──
    case "creator-hormozi":
      return (
        <span style={baseFont}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                color: i === 1 ? s.highlightColor ?? "#FACC15" : s.color,
                backgroundColor:
                  i === 1 ? "rgba(250,204,21,0.15)" : "transparent",
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

    // ── MrBeast: alternating colors ──
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

    // ── Ali Abdaal: blue highlight word ──
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

    // ── MKBHD: red accent word ──
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

    // ── Alex Earle: pink TikTok ──
    case "creator-alex-earle":
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
                animation: isPreview
                  ? `bounce-word 0.6s ease ${i * 0.1}s infinite`
                  : undefined,
              }}
            >
              {w}
            </span>
          ))}
        </span>
      );

    // ── Karaoke: sweep highlight ──
    case "animated-karaoke":
    case "social-youtube-shorts":
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

    // ── Typewriter ──
    case "animated-typewriter":
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

    // ── Bounce: each word bounces ──
    case "animated-bounce":
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

    // ── Fade Word ──
    case "animated-fade-word":
      return (
        <span style={baseFont}>
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

    // ── Pop-in ──
    case "animated-pop-in":
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

    // ── Wave ──
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

    // ── Neon Glow ──
    case "stylized-neon":
      return (
        <span style={{ ...baseFont, animation: "neon-pulse 2s ease-in-out infinite" }}>
          {text}
        </span>
      );

    // ── Cinematic: letterbox bars ──
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
          <div
            style={{
              width: "90%",
              height: "2px",
              backgroundColor: "rgba(245,245,220,0.3)",
              marginBottom: "6px",
            }}
          />
          <span style={{ ...baseFont, letterSpacing: "0.15em", fontStyle: "italic" }}>
            {text}
          </span>
          <div
            style={{
              width: "90%",
              height: "2px",
              backgroundColor: "rgba(245,245,220,0.3)",
              marginTop: "6px",
            }}
          />
        </div>
      );

    // ── Retro VHS ──
    case "stylized-retro-vhs":
      return (
        <span
          style={{
            ...baseFont,
            animation: "vhs-glitch 0.3s ease infinite",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "2px",
              top: "0",
              color: "#00FFFF",
              opacity: 0.5,
              zIndex: -1,
            }}
          >
            {text}
          </span>
          <span
            style={{
              position: "absolute",
              left: "-2px",
              top: "0",
              color: "#FF00FF",
              opacity: 0.5,
              zIndex: -1,
            }}
          >
            {text}
          </span>
          {text}
        </span>
      );

    // ── Comic Book: speech bubble ──
    case "stylized-comic":
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

    // ── Handwritten ──
    case "stylized-handwritten":
      return (
        <span
          style={{
            ...baseFont,
            animation: "handwrite-in 0.8s ease both",
          }}
        >
          {text}
        </span>
      );

    // ── Gradient Flow ──
    case "stylized-gradient-flow":
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

    // ── TikTok Native: pop ──
    case "social-tiktok":
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

    // ── Reels: slide up ──
    case "social-reels":
      return (
        <span
          style={{
            ...baseFont,
            backgroundColor: s.backgroundColor,
            padding: "6px 14px",
            borderRadius: "8px",
            animation: "slide-up 0.4s ease both",
          }}
        >
          {text}
        </span>
      );

    // ── Twitter clip ──
    case "social-twitter":
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

    // ── Emoji Captions ──
    case "special-emoji":
      return (
        <span style={baseFont}>
          {text.split(" ").map((w, i) => {
            const isEmoji = /^\p{Emoji}/u.test(w);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "5px",
                  animation: isEmoji
                    ? "emoji-bounce 0.6s ease infinite"
                    : `bounce-word 0.5s ease ${i * 0.1}s infinite`,
                }}
              >
                {w}
              </span>
            );
          })}
        </span>
      );

    // ── Bilingual ──
    case "special-bilingual": {
      const lines = text.split("\n");
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <span style={{ ...baseFont, fontSize: `${fontSize}px` }}>{lines[0]}</span>
          {lines[1] && (
            <span
              style={{
                ...baseFont,
                fontSize: `${Math.max(fontSize - 4, 12)}px`,
                color: s.highlightColor ?? "#A78BFA",
                opacity: 0.8,
                fontStyle: "italic",
              }}
            >
              {lines[1]}
            </span>
          )}
        </div>
      );
    }

    // ── Iman Gadzhi: luxury gold ──
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

    // ── Default fallback ──
    default:
      return (
        <span
          style={{
            ...baseFont,
            ...(s.backgroundColor
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
    initialStyle?.id ?? "classic-default"
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
                {getStyleRenderer(s, s.id === "special-emoji" ? "Ai ✨ powered 🚀 editing 🎬" : captionText, true)}
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
            selectedStyle.id === "special-emoji"
              ? "Ai ✨ powered 🚀 editing 🎬"
              : selectedStyle.id === "special-bilingual"
                ? `${captionText}\n${captionText === "Ai powered editing" ? "AI redagavimas" : captionText}`
                : captionText,
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
