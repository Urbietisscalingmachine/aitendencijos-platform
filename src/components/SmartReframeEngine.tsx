"use client";

import React, { useState, useCallback } from "react";
import type { ReframeContentType, ReframePreset, CropPosition, AspectRatioPreset } from "@/types/cineflow";

const ACCENT = "#8B5CF6";
const BORDER = "rgba(255,255,255,0.08)";

const REFRAME_PRESETS: ReframePreset[] = [
  {
    id: "talking-head",
    label: "Talking Head",
    icon: "🗣️",
    cropX: 0,
    cropY: -10,
    scale: 1.5,
    description: "Centre crop, slight zoom — ideal for vlogs and talking head content",
  },
  {
    id: "presentation",
    label: "Presentation",
    icon: "📊",
    cropX: 15,
    cropY: -5,
    scale: 1.3,
    description: "Right-of-centre crop — keeps speaker and slides visible",
  },
  {
    id: "group",
    label: "Group",
    icon: "👥",
    cropX: 0,
    cropY: 0,
    scale: 1.15,
    description: "Wider crop, minimal zoom — fits multiple people in frame",
  },
  {
    id: "landscape",
    label: "B-Roll / Landscape",
    icon: "🌄",
    cropX: 0,
    cropY: 0,
    scale: 1.8,
    description: "Slow pan — great for landscape and b-roll footage",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "🎯",
    cropX: 0,
    cropY: 0,
    scale: 1,
    description: "Set your own crop position and scale",
  },
];

interface SmartReframeEngineProps {
  currentAspectRatio: AspectRatioPreset;
  cropPosition: CropPosition;
  onCropChange: (position: CropPosition) => void;
  onAspectRatioChange: (ratio: AspectRatioPreset) => void;
}

export default function SmartReframeEngine({
  currentAspectRatio,
  cropPosition,
  onCropChange,
  onAspectRatioChange,
}: SmartReframeEngineProps) {
  const [selectedPreset, setSelectedPreset] = useState<ReframeContentType | null>(null);
  const [applied, setApplied] = useState(false);

  const handlePresetSelect = useCallback(
    (preset: ReframePreset) => {
      setSelectedPreset(preset.id);
      setApplied(false);

      if (preset.id !== "custom") {
        onCropChange({
          x: preset.cropX,
          y: preset.cropY,
          scale: preset.scale,
        });
      }
    },
    [onCropChange]
  );

  const handleApply = useCallback(() => {
    setApplied(true);
    // Ensure a non-auto aspect ratio is set for reframing
    if (currentAspectRatio === "auto") {
      onAspectRatioChange("9:16");
    }
  }, [currentAspectRatio, onAspectRatioChange]);

  const targetFormats: { id: AspectRatioPreset; label: string; icon: string }[] = [
    { id: "9:16", label: "9:16 Vertical", icon: "📱" },
    { id: "1:1", label: "1:1 Square", icon: "⬜" },
    { id: "4:5", label: "4:5 IG Feed", icon: "📷" },
    { id: "16:9", label: "16:9 Landscape", icon: "🖥️" },
  ];

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Smart Reframe</h3>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Automatiškai reframe&apos;ink video į kitą formatą — AI seka veidą ir optimizuoja crop poziciją.
      </p>

      {/* Target format */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Target Format
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {targetFormats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => {
                onAspectRatioChange(fmt.id);
                setApplied(false);
              }}
              style={{
                flex: 1,
                minWidth: 70,
                padding: "8px 6px",
                borderRadius: 10,
                border: `1px solid ${currentAspectRatio === fmt.id ? ACCENT : BORDER}`,
                background: currentAspectRatio === fmt.id ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                color: currentAspectRatio === fmt.id ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span style={{ fontSize: 16 }}>{fmt.icon}</span>
              <span>{fmt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content type presets */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Content Type
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REFRAME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${selectedPreset === preset.id ? ACCENT : BORDER}`,
                background: selectedPreset === preset.id ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{preset.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: selectedPreset === preset.id ? "#fff" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {preset.label}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2, lineHeight: 1.4 }}>
                  {preset.description}
                </div>
              </div>
              {selectedPreset === preset.id && (
                <span style={{ color: ACCENT, fontSize: 14, flexShrink: 0 }}>●</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Manual controls (always visible when custom, or after selecting any preset) */}
      {selectedPreset && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: "rgba(0,0,0,0.2)",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 10, textTransform: "uppercase" }}>
            Fine-tune
          </div>

          {/* X offset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", width: 50 }}>X Offset</span>
            <input
              type="range"
              min="-50"
              max="50"
              value={cropPosition.x}
              onChange={(e) => {
                onCropChange({ ...cropPosition, x: Number(e.target.value) });
                setApplied(false);
              }}
              style={{ flex: 1, accentColor: ACCENT }}
            />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", width: 30, textAlign: "right" }}>
              {cropPosition.x.toFixed(0)}
            </span>
          </div>

          {/* Y offset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", width: 50 }}>Y Offset</span>
            <input
              type="range"
              min="-50"
              max="50"
              value={cropPosition.y}
              onChange={(e) => {
                onCropChange({ ...cropPosition, y: Number(e.target.value) });
                setApplied(false);
              }}
              style={{ flex: 1, accentColor: ACCENT }}
            />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", width: 30, textAlign: "right" }}>
              {cropPosition.y.toFixed(0)}
            </span>
          </div>

          {/* Scale/Zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", width: 50 }}>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={cropPosition.scale}
              onChange={(e) => {
                onCropChange({ ...cropPosition, scale: Number(e.target.value) });
                setApplied(false);
              }}
              style={{ flex: 1, accentColor: ACCENT }}
            />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", width: 30, textAlign: "right" }}>
              {cropPosition.scale.toFixed(1)}x
            </span>
          </div>
        </div>
      )}

      {/* Apply button */}
      {selectedPreset && (
        <button
          onClick={handleApply}
          disabled={applied}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: "none",
            background: applied
              ? "rgba(34,197,94,0.15)"
              : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
            color: applied ? "#22c55e" : "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: applied ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {applied ? "✅ Reframe Applied" : "🎯 Apply Reframe"}
        </button>
      )}
    </div>
  );
}
