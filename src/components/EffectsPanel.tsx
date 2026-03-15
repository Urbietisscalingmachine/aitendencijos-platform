"use client";
/* ═══════════════════════════════════════════════════════════
   CINEFLOW — Effects Panel (Side Panel Wrapper)
   Collapsible right-side panel that hosts the EffectsEngine.
   Features: search, recently-used, drag-to-timeline.
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useRef, useMemo } from "react";
import EffectsEngine from "./EffectsEngine";
import type { EffectType, EffectKeyframe } from "@/types/cineflow";

// ─── Design tokens (same as engine) ────────────────────

const ACCENT = "#8B5CF6";
const BG = "#09090b";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#f5f5f5";
const TEXT_SECONDARY = "#a1a1aa";
const TEXT_MUTED = "#71717a";

// ─── Recently used effect record ────────────────────────

interface RecentEffect {
  id: string;
  type: EffectType | string;
  label: string;
  icon: string;
  usedAt: number; // timestamp
}

// ─── Search index (label → effect type) ────────────────

interface SearchableEffect {
  label: string;
  category: string;
  icon: string;
  effectType: string;
}

const SEARCHABLE_EFFECTS: SearchableEffect[] = [
  // Zoom
  { label: "Ken Burns", category: "Zoom", icon: "🎬", effectType: "ken-burns" },
  { label: "Quick Emphasis", category: "Zoom", icon: "⚡", effectType: "zoom-in" },
  { label: "Zoom + Shake", category: "Zoom", icon: "📳", effectType: "zoom-shake" },
  { label: "Zoom Pulse", category: "Zoom", icon: "💫", effectType: "zoom-pulse" },
  // Color
  { label: "Warm", category: "Color", icon: "🎨", effectType: "color-warm" },
  { label: "Cold", category: "Color", icon: "🎨", effectType: "color-cold" },
  { label: "Cinematic", category: "Color", icon: "🎨", effectType: "color-cinematic" },
  { label: "Vintage", category: "Color", icon: "🎨", effectType: "color-vintage" },
  { label: "High Contrast", category: "Color", icon: "🎨", effectType: "color-highcontrast" },
  { label: "Black & White", category: "Color", icon: "🎨", effectType: "color-bw" },
  { label: "Moody", category: "Color", icon: "🎨", effectType: "color-bw" },
  // Filters
  { label: "Gaussian Blur", category: "Filters", icon: "🌫️", effectType: "blur" },
  { label: "Vignette", category: "Filters", icon: "🔲", effectType: "vignette" },
  { label: "Film Grain", category: "Filters", icon: "📺", effectType: "grain" },
  { label: "Sharpen", category: "Filters", icon: "🔪", effectType: "sharpen" },
  { label: "Glitch", category: "Filters", icon: "📡", effectType: "sharpen" },
  // Text
  { label: "Text Overlay", category: "Text", icon: "𝐓", effectType: "text-overlay" },
  { label: "Lower Third", category: "Text", icon: "📋", effectType: "lower-third" },
  { label: "Animated Title", category: "Text", icon: "🎬", effectType: "title-animated" },
  // Emoji
  { label: "Emoji", category: "Emoji", icon: "😀", effectType: "emoji" },
  { label: "Sticker", category: "Emoji", icon: "🎯", effectType: "sticker" },
  // Transitions
  { label: "Cut", category: "Transitions", icon: "✂️", effectType: "transition-cut" },
  { label: "Crossfade", category: "Transitions", icon: "🌅", effectType: "transition-crossfade" },
  { label: "Slide", category: "Transitions", icon: "➡️", effectType: "transition-slide" },
  { label: "Zoom Transition", category: "Transitions", icon: "🔎", effectType: "transition-zoom" },
  { label: "Glitch Transition", category: "Transitions", icon: "📡", effectType: "transition-glitch" },
  { label: "Wipe", category: "Transitions", icon: "🧹", effectType: "transition-slide" },
];

// ─── Props ──────────────────────────────────────────────

export interface EffectsPanelProps {
  /** panel open/collapsed */
  defaultOpen?: boolean;
  /** currently selected clip id */
  selectedClipId?: string;
  /** current playback time */
  currentTime?: number;
  /** total duration */
  totalDuration?: number;
  /** called when effect keyframe is emitted */
  onAddEffect?: (keyframe: EffectKeyframe) => void;
  /** called when color CSS filter changes */
  onColorFilterChange?: (cssFilter: string) => void;
  /** called when dragging effect onto timeline clip */
  onDropEffectOnClip?: (clipId: string, effectType: string) => void;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function EffectsPanel({
  defaultOpen = true,
  selectedClipId,
  currentTime = 0,
  totalDuration = 30,
  onAddEffect,
  onColorFilterChange,
  onDropEffectOnClip,
}: EffectsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEffects, setRecentEffects] = useState<RecentEffect[]>([]);
  const [draggingEffect, setDraggingEffect] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ─── Panel width ─────────────────────
  const PANEL_WIDTH = 360;
  const COLLAPSED_WIDTH = 44;

  // ─── Track recent effects ────────────
  const trackRecent = useCallback((type: string, label: string, icon: string) => {
    setRecentEffects((prev) => {
      const filtered = prev.filter((r) => r.type !== type);
      return [{ id: `recent-${Date.now()}`, type: type as EffectType, label, icon, usedAt: Date.now() }, ...filtered].slice(0, 8);
    });
  }, []);

  const handleAddEffect = useCallback(
    (kf: EffectKeyframe) => {
      trackRecent(kf.type, kf.type, "✨");
      onAddEffect?.(kf);
    },
    [trackRecent, onAddEffect]
  );

  // ─── Search results ──────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return SEARCHABLE_EFFECTS.filter(
      (e) => e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // ─── Drag handlers ───────────────────
  const handleDragStart = useCallback((effectType: string) => {
    setDraggingEffect(effectType);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingEffect(null);
  }, []);

  // ═════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════

  return (
    <>
      {/* Inline styles for animations */}
      <style>{`
        @keyframes panelSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes panelSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes recentPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
          50% { box-shadow: 0 0 8px 2px rgba(139,92,246,0.3); }
        }
        .fx-panel-scroll::-webkit-scrollbar { width: 4px; }
        .fx-panel-scroll::-webkit-scrollbar-track { background: transparent; }
        .fx-panel-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
      `}</style>

      <div
        ref={panelRef}
        style={{
          position: "relative",
          width: isOpen ? PANEL_WIDTH : COLLAPSED_WIDTH,
          height: "100%",
          background: BG,
          borderLeft: `1px solid ${BORDER}`,
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          flexShrink: 0,
        }}
      >
        {/* ─── Collapsed sidebar ─── */}
        {!isOpen && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 12,
              gap: 12,
            }}
          >
            <button
              onClick={() => setIsOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: TEXT_PRIMARY,
                cursor: "pointer",
                fontSize: 20,
                padding: 8,
                borderRadius: 8,
                transition: "background 0.2s",
              }}
              title="Open Effects Panel"
            >
              ✨
            </button>
            <div
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                fontSize: 11,
                fontWeight: 600,
                color: TEXT_MUTED,
                letterSpacing: "0.05em",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setIsOpen(true)}
            >
              EFFECTS
            </div>
          </div>
        )}

        {/* ─── Expanded panel ─── */}
        {isOpen && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              animation: "panelSlideIn 0.3s ease-out",
            }}
          >
            {/* ─── Header ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(12px)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>Effects</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: TEXT_MUTED,
                  cursor: "pointer",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  transition: "all 0.2s",
                }}
                title="Collapse panel"
              >
                ›
              </button>
            </div>

            {/* ─── Search ─── */}
            <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    color: TEXT_MUTED,
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search effects..."
                  style={{
                    width: "100%",
                    padding: "8px 10px 8px 32px",
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: "rgba(255,255,255,0.04)",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = `${ACCENT}66`)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>
            </div>

            {/* ─── Search Results ─── */}
            {searchQuery.trim() && searchResults.length > 0 && (
              <div style={{ padding: "0 14px 8px", flexShrink: 0 }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    padding: 6,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((result, i) => (
                    <div
                      key={`${result.effectType}-${i}`}
                      draggable
                      onDragStart={() => handleDragStart(result.effectType)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        cursor: "grab",
                        transition: "background 0.15s",
                        fontSize: 13,
                        color: TEXT_PRIMARY,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 16 }}>{result.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{result.label}</div>
                        <div style={{ fontSize: 10, color: TEXT_MUTED }}>{result.category}</div>
                      </div>
                      <span style={{ fontSize: 11, color: TEXT_MUTED }}>⠿</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery.trim() && searchResults.length === 0 && (
              <div style={{ padding: "0 14px 8px", fontSize: 12, color: TEXT_MUTED, textAlign: "center" }}>
                No effects matching &quot;{searchQuery}&quot;
              </div>
            )}

            {/* ─── Recently Used ─── */}
            {!searchQuery.trim() && recentEffects.length > 0 && (
              <div style={{ padding: "4px 14px 8px", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  Recently Used
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {recentEffects.map((r) => (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={() => handleDragStart(r.type)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: "rgba(139,92,246,0.1)",
                        border: `1px solid rgba(139,92,246,0.2)`,
                        cursor: "grab",
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        fontWeight: 500,
                        transition: "all 0.2s",
                        animation: "recentPulse 2s ease-in-out",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(139,92,246,0.2)";
                        e.currentTarget.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(139,92,246,0.1)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{r.icon}</span>
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Effects Engine (main content) ─── */}
            <div
              className="fx-panel-scroll"
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <EffectsEngine
                selectedClipId={selectedClipId}
                currentTime={currentTime}
                totalDuration={totalDuration}
                onAddEffect={handleAddEffect}
                onColorFilterChange={onColorFilterChange}
              />
            </div>

            {/* ─── Footer / Clip Target ─── */}
            {selectedClipId && (
              <div
                style={{
                  padding: "8px 14px",
                  borderTop: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 6px rgba(34,197,94,0.4)",
                  }}
                />
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                  Target: <span style={{ color: ACCENT, fontWeight: 600 }}>{selectedClipId}</span>
                </span>
              </div>
            )}

            {!selectedClipId && (
              <div
                style={{
                  padding: "10px 14px",
                  borderTop: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.3)",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>Select a clip on timeline to apply effects</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Drag overlay ─── */}
        {draggingEffect && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                padding: "8px 16px",
                borderRadius: 8,
                background: "rgba(139,92,246,0.9)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 4px 24px rgba(139,92,246,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              Drop on timeline clip → {draggingEffect}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
