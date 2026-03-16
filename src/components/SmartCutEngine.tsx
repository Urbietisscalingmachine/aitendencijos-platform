"use client";

import React, { useState, useCallback, useMemo } from "react";
import type { TranscriptSegment, SmartCut, SmartCutResult } from "@/types/cineflow";

const ACCENT = "#8B5CF6";
const BORDER = "rgba(255,255,255,0.08)";

const FILLER_WORDS = [
  // English
  "um", "uh", "like", "so", "well", "you know", "i mean", "basically",
  "actually", "literally", "right", "okay", "mmm", "ehh", "hmm", "ah",
  // Lithuanian
  "nu", "tipo", "čia", "na", "tai", "va", "nu tai", "žinai", "kaip",
  "šiaip", "trumpai tariant", "reiškia",
];

const MIN_PAUSE_GAP = 1.0; // seconds
const REPEAT_SIMILARITY_THRESHOLD = 0.7;

function levenshteinSimilarity(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const matrix: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[la][lb] / Math.max(la, lb);
}

function findSmartCuts(transcript: TranscriptSegment[]): SmartCutResult {
  const cuts: SmartCut[] = [];
  let cutId = 0;

  for (let i = 0; i < transcript.length; i++) {
    const seg = transcript[i];
    const text = seg.text.toLowerCase().trim();

    // 1. Filler words detection
    const isFillerOnly = FILLER_WORDS.some((f) => {
      const cleaned = text.replace(/[.,!?;:]/g, "").trim();
      return cleaned === f || cleaned === `${f}` || text.split(/\s+/).length <= 2 && cleaned.includes(f);
    });

    if (isFillerOnly && seg.end - seg.start < 2) {
      cuts.push({
        id: `sc-${cutId++}`,
        start: seg.start,
        end: seg.end,
        type: "filler",
        label: `filler "${seg.text.trim()}"`,
        selected: true,
      });
    }

    // 2. Gaps between segments (pauses)
    if (i > 0) {
      const prevEnd = transcript[i - 1].end;
      const gap = seg.start - prevEnd;
      if (gap > MIN_PAUSE_GAP) {
        cuts.push({
          id: `sc-${cutId++}`,
          start: prevEnd,
          end: seg.start,
          type: "pause",
          label: `${gap.toFixed(1)}s pause`,
          selected: true,
        });
      }
    }

    // 3. Repeat detection (consecutive similar segments)
    if (i > 0) {
      const prevText = transcript[i - 1].text.toLowerCase().trim();
      const similarity = levenshteinSimilarity(prevText, text);
      if (similarity > REPEAT_SIMILARITY_THRESHOLD && text.length > 5) {
        cuts.push({
          id: `sc-${cutId++}`,
          start: seg.start,
          end: seg.end,
          type: "repeat",
          label: `repeat of prev segment`,
          selected: true,
        });
      }
    }
  }

  // Sort by start time
  cuts.sort((a, b) => a.start - b.start);

  // Calculate totals
  const totalSaved = cuts.filter((c) => c.selected).reduce((sum, c) => sum + (c.end - c.start), 0);
  const origDuration = transcript.length > 0 ? transcript[transcript.length - 1].end : 0;

  return {
    cuts,
    totalSaved,
    originalDuration: origDuration,
    newDuration: origDuration - totalSaved,
  };
}

function formatTimestamp(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

interface SmartCutEngineProps {
  transcript: TranscriptSegment[];
  onApplyCuts: (cuts: SmartCut[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function SmartCutEngine({
  transcript,
  onApplyCuts,
  currentTime,
  onSeek,
}: SmartCutEngineProps) {
  const [result, setResult] = useState<SmartCutResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (transcript.length === 0) return;
    setAnalyzing(true);
    setApplied(false);
    // Simulate slight delay for UX
    setTimeout(() => {
      const r = findSmartCuts(transcript);
      setResult(r);
      setAnalyzing(false);
    }, 600);
  }, [transcript]);

  const toggleCut = useCallback((cutId: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const newCuts = prev.cuts.map((c) =>
        c.id === cutId ? { ...c, selected: !c.selected } : c
      );
      const totalSaved = newCuts.filter((c) => c.selected).reduce((sum, c) => sum + (c.end - c.start), 0);
      return {
        ...prev,
        cuts: newCuts,
        totalSaved,
        newDuration: prev.originalDuration - totalSaved,
      };
    });
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setResult((prev) => {
      if (!prev) return prev;
      const newCuts = prev.cuts.map((c) => ({ ...c, selected }));
      const totalSaved = selected ? newCuts.reduce((sum, c) => sum + (c.end - c.start), 0) : 0;
      return {
        ...prev,
        cuts: newCuts,
        totalSaved,
        newDuration: prev.originalDuration - totalSaved,
      };
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!result) return;
    const selectedCuts = result.cuts.filter((c) => c.selected);
    if (selectedCuts.length === 0) return;
    onApplyCuts(selectedCuts);
    setApplied(true);
  }, [result, onApplyCuts]);

  const selectedCount = result ? result.cuts.filter((c) => c.selected).length : 0;

  const cutTypeIcon: Record<string, string> = {
    filler: "🗣️",
    pause: "⏸️",
    repeat: "🔁",
    "low-substance": "💤",
  };

  const cutTypeColor: Record<string, string> = {
    filler: "#f59e0b",
    pause: "#6366f1",
    repeat: "#ef4444",
    "low-substance": "#94a3b8",
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>✂️</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Smart Cut</h3>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.5 }}>
        AI automatiškai randa ir pašalina pauzės, filler žodžius (&quot;um&quot;, &quot;nu&quot;, &quot;tipo&quot;), ir pasikartojimus.
      </p>

      {/* Analyze Button */}
      {!result && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing || transcript.length === 0}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: "none",
            background: analyzing
              ? "rgba(139,92,246,0.2)"
              : transcript.length === 0
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
            color: transcript.length === 0 ? "rgba(255,255,255,0.3)" : "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: transcript.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {analyzing ? (
            <>
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Analizuojama...
            </>
          ) : transcript.length === 0 ? (
            "Reikia transkripcijos"
          ) : (
            "🔍 Analyze & Find Cuts"
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div style={{ animation: "slide-up 0.3s ease" }}>
          {/* Summary */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `1px solid rgba(139,92,246,0.2)`,
              background: "rgba(139,92,246,0.05)",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                Found: {result.cuts.length} potential cuts
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>
                -{result.totalSaved.toFixed(1)}s
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Video: {formatTimestamp(result.originalDuration)} → {formatTimestamp(result.newDuration)}
            </div>
            {/* Category breakdown */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {(["filler", "pause", "repeat"] as const).map((type) => {
                const count = result.cuts.filter((c) => c.type === type).length;
                if (count === 0) return null;
                return (
                  <span key={type} style={{ fontSize: 10, color: cutTypeColor[type], display: "flex", alignItems: "center", gap: 3 }}>
                    {cutTypeIcon[type]} {count} {type}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Select All / None */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => selectAll(true)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Select All
            </button>
            <button
              onClick={() => selectAll(false)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Deselect All
            </button>
            <button
              onClick={() => {
                setResult(null);
                setApplied(false);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Re-analyze
            </button>
          </div>

          {/* Cut list */}
          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {result.cuts.map((cut) => (
              <div
                key={cut.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderBottom: `1px solid ${BORDER}`,
                  background: cut.selected ? "rgba(139,92,246,0.04)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onClick={() => toggleCut(cut.id)}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1.5px solid ${cut.selected ? ACCENT : "rgba(255,255,255,0.2)"}`,
                    background: cut.selected ? ACCENT : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {cut.selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>

                {/* Type icon */}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{cutTypeIcon[cut.type]}</span>

                {/* Timestamp */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(cut.start);
                  }}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    border: "none",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 10,
                    fontFamily: "monospace",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {formatTimestamp(cut.start)}-{formatTimestamp(cut.end)}
                </button>

                {/* Label */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cut.label}
                </span>

                {/* Duration */}
                <span style={{ fontSize: 10, color: cutTypeColor[cut.type], fontWeight: 600, flexShrink: 0 }}>
                  {(cut.end - cut.start).toFixed(1)}s
                </span>
              </div>
            ))}
          </div>

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={selectedCount === 0 || applied}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: applied
                ? "rgba(34,197,94,0.15)"
                : selectedCount === 0
                  ? "rgba(255,255,255,0.05)"
                  : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
              color: applied ? "#22c55e" : selectedCount === 0 ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: selectedCount === 0 || applied ? "default" : "pointer",
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {applied ? (
              <>✅ Cuts Applied ({selectedCount})</>
            ) : (
              <>✂️ Apply {selectedCount} Cuts</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
