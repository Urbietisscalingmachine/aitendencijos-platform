"use client";

/* ═══════════════════════════════════════════════════════════
   SmartAIEngine — 🧠 AI Tab for Cineflow Editor
   Features: Hook Generator, Auto Chapters, Virality Score,
             Caption Translation, AI Highlight Reel, SEO Optimizer
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useCallback } from "react";

// ── Types ───────────────────────────────────────────────

interface TimelineClip {
  id: string;
  trackType: string;
  trackIndex: number;
  startTime: number;
  duration: number;
  label?: string;
  effectType?: string;
  src?: string;
  words?: { word: string; start: number; end: number }[];
  style?: Record<string, unknown>;
}

interface Hook {
  type: string;
  text: string;
  cutPoint: number;
  explanation: string;
}

interface Chapter {
  title: string;
  timestamp: number;
  endTimestamp: number;
  summary: string;
}

interface ViralityBreakdownItem {
  score: number;
  max: number;
  status: "good" | "warning" | "bad";
  note: string;
}

interface ViralityResult {
  score: number;
  stars: number;
  breakdown: Record<string, ViralityBreakdownItem>;
  tips: { type: string; icon: string; text: string }[];
}

interface Translation {
  index: number;
  original: string;
  translated: string;
}

interface HighlightClip {
  start: number;
  end: number;
  label: string;
  reason: string;
  importance: string;
}

interface SeoResult {
  title: string;
  titleAlternatives: string[];
  description: string;
  hashtags: string[];
  tags: string[];
  thumbnail: string;
}

interface SmartAIEngineProps {
  transcript: string;
  subtitleClips: TimelineClip[];
  currentTime: number;
  totalDuration: number;
  onAddClip: (clip: Omit<TimelineClip, "id">) => void;
  onUpdateClip: (clipId: string, changes: Partial<TimelineClip>) => void;
}

// ── Constants ────────────────────────────────────────────

const ACCENT = "#8B5CF6";
const BORDER = "rgba(255,255,255,0.08)";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

type SmartFeatureSection = "hooks" | "chapters" | "virality" | "translate" | "highlight" | "seo";

// ── Helpers ──────────────────────────────────────────────

function formatTimestamp(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────

export default function SmartAIEngine({
  transcript,
  subtitleClips,
  currentTime,
  totalDuration,
  onAddClip,
  onUpdateClip,
}: SmartAIEngineProps) {
  // ── Feature states ─────────────────────────────────
  const [activeSection, setActiveSection] = useState<SmartFeatureSection | null>(null);
  const [loading, setLoading] = useState<SmartFeatureSection | null>(null);

  // ── Hooks state ────────────────────────────────────
  const [hooks, setHooks] = useState<Hook[]>([]);

  // ── Chapters state ─────────────────────────────────
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // ── Virality state ─────────────────────────────────
  const [viralityResult, setViralityResult] = useState<ViralityResult | null>(null);

  // ── Translation state ──────────────────────────────
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedLang, setSelectedLang] = useState("en");
  const [originalTexts, setOriginalTexts] = useState<Map<string, string>>(new Map());
  const [translationApplied, setTranslationApplied] = useState(false);

  // ── Highlight state ────────────────────────────────
  const [highlightClips, setHighlightClips] = useState<HighlightClip[]>([]);
  const [highlightDuration, setHighlightDuration] = useState<30 | 60>(30);

  // ── SEO state ──────────────────────────────────────
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ── API call helper ────────────────────────────────
  const callSmartFeatures = useCallback(
    async (
      feature: SmartFeatureSection,
      extra?: Record<string, unknown>
    ) => {
      if (!transcript || transcript.trim().length < 10) {
        alert("Nėra transkripcijos. Pirmiausia įkelkite ir transkribuokite video.");
        return null;
      }

      setLoading(feature);
      try {
        const body: Record<string, unknown> = {
          transcript,
          feature,
          ...extra,
        };

        const res = await fetch("/api/smart-features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error(`[SmartAI] ${feature} error:`, err);
          alert(`AI klaida: ${err.error || "Nepavyko"}`);
          return null;
        }

        return await res.json();
      } catch (err) {
        console.error(`[SmartAI] ${feature} fetch error:`, err);
        alert("Nepavyko susisiekti su AI serveriu");
        return null;
      } finally {
        setLoading(null);
      }
    },
    [transcript]
  );

  // ── Hook Generator ─────────────────────────────────
  const generateHooks = useCallback(async () => {
    const data = await callSmartFeatures("hooks");
    if (data?.hooks) {
      setHooks(data.hooks);
      setActiveSection("hooks");
    }
  }, [callSmartFeatures]);

  const useHook = useCallback(
    (hook: Hook) => {
      onAddClip({
        trackType: "effect",
        trackIndex: 4,
        startTime: hook.cutPoint,
        duration: 3,
        label: hook.text,
        effectType: "text-overlay",
      });
    },
    [onAddClip]
  );

  // ── Auto Chapters ──────────────────────────────────
  const generateChapters = useCallback(async () => {
    const data = await callSmartFeatures("chapters");
    if (data?.chapters) {
      setChapters(data.chapters);
      setActiveSection("chapters");
    }
  }, [callSmartFeatures]);

  const addChaptersToTimeline = useCallback(() => {
    chapters.forEach((ch) => {
      onAddClip({
        trackType: "effect",
        trackIndex: 4,
        startTime: ch.timestamp,
        duration: Math.max(2, (ch.endTimestamp || ch.timestamp + 5) - ch.timestamp),
        label: `📑 ${ch.title}`,
        effectType: "text-overlay",
      });
    });
  }, [chapters, onAddClip]);

  // ── Virality Score ─────────────────────────────────
  const analyzeVirality = useCallback(async () => {
    const data = await callSmartFeatures("virality");
    if (data?.score !== undefined) {
      setViralityResult(data as ViralityResult);
      setActiveSection("virality");
    }
  }, [callSmartFeatures]);

  // ── Caption Translation ────────────────────────────
  const translateCaptions = useCallback(async () => {
    const subs = subtitleClips.filter((c) => c.trackType === "subtitle" && c.label);
    if (subs.length === 0) {
      alert("Nėra subtitrų vertimui");
      return;
    }

    const subtitleData = subs.map((s, i) => ({
      text: s.label || "",
      start: s.startTime,
      end: s.startTime + s.duration,
    }));

    const data = await callSmartFeatures("translate", {
      targetLang: selectedLang,
      subtitles: subtitleData,
    });

    if (data?.translations) {
      setTranslations(data.translations);
      setActiveSection("translate");
      setTranslationApplied(false);

      // Save originals for revert
      if (originalTexts.size === 0) {
        const originals = new Map<string, string>();
        subs.forEach((s) => {
          originals.set(s.id, s.label || "");
        });
        setOriginalTexts(originals);
      }
    }
  }, [callSmartFeatures, selectedLang, subtitleClips, originalTexts.size]);

  const applyTranslation = useCallback(() => {
    const subs = subtitleClips.filter((c) => c.trackType === "subtitle");
    translations.forEach((t) => {
      if (t.index < subs.length) {
        onUpdateClip(subs[t.index].id, { label: t.translated });
      }
    });
    setTranslationApplied(true);
  }, [translations, subtitleClips, onUpdateClip]);

  const revertTranslation = useCallback(() => {
    originalTexts.forEach((originalLabel, clipId) => {
      onUpdateClip(clipId, { label: originalLabel });
    });
    setTranslationApplied(false);
    setTranslations([]);
  }, [originalTexts, onUpdateClip]);

  // ── AI Highlight Reel ──────────────────────────────
  const generateHighlight = useCallback(async () => {
    const data = await callSmartFeatures("highlight", {
      duration: highlightDuration,
    });
    if (data?.clips) {
      setHighlightClips(data.clips);
      setActiveSection("highlight");
    }
  }, [callSmartFeatures, highlightDuration]);

  const createHighlightTimeline = useCallback(() => {
    highlightClips.forEach((clip) => {
      onAddClip({
        trackType: "effect",
        trackIndex: 4,
        startTime: clip.start,
        duration: clip.end - clip.start,
        label: `🎬 ${clip.label}`,
        effectType: "text-overlay",
      });
    });
  }, [highlightClips, onAddClip]);

  // ── SEO Optimizer ──────────────────────────────────
  const generateSeo = useCallback(async () => {
    const data = await callSmartFeatures("seo");
    if (data?.title) {
      setSeoResult(data as SeoResult);
      setActiveSection("seo");
    }
  }, [callSmartFeatures]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  // ── Loading Spinner ────────────────────────────────
  const Spinner = () => (
    <div
      style={{
        width: 16,
        height: 16,
        border: "2px solid rgba(139,92,246,0.3)",
        borderTopColor: ACCENT,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
      }}
    />
  );

  // ── Section Button ─────────────────────────────────
  const SectionButton = ({
    icon,
    label,
    section,
    onClick,
    hasResults,
  }: {
    icon: string;
    label: string;
    section: SmartFeatureSection;
    onClick: () => void;
    hasResults: boolean;
  }) => {
    const isActive = activeSection === section;
    const isLoading = loading === section;

    return (
      <button
        onClick={() => {
          if (isActive) {
            setActiveSection(null);
          } else if (hasResults) {
            setActiveSection(section);
          } else {
            onClick();
          }
        }}
        disabled={isLoading}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${isActive ? ACCENT : BORDER}`,
          background: isActive
            ? "rgba(139,92,246,0.1)"
            : "rgba(255,255,255,0.02)",
          cursor: isLoading ? "wait" : "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
          transition: "all 0.2s",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
          }}
        >
          {label}
        </span>
        {isLoading && <Spinner />}
        {hasResults && !isLoading && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#22c55e",
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(34,197,94,0.1)",
            }}
          >
            ✓
          </span>
        )}
        {!hasResults && !isLoading && (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            →
          </span>
        )}
      </button>
    );
  };

  // ── Render sections ────────────────────────────────

  const renderHooks = () => (
    <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
      {hooks.map((hook, i) => {
        const typeLabels: Record<string, string> = {
          question: "❓ Question Hook",
          bold_statement: "💥 Bold Statement",
          curiosity_gap: "🔮 Curiosity Gap",
        };
        return (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.02)",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: ACCENT,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              {typeLabels[hook.type] || hook.type}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                marginBottom: 6,
                lineHeight: 1.4,
              }}
            >
              &ldquo;{hook.text}&rdquo;
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              {hook.explanation}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                Cut point: {formatTimestamp(hook.cutPoint)}
              </span>
              <button
                onClick={() => useHook(hook)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 28,
                }}
              >
                ✅ Use
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={generateHooks}
        disabled={loading === "hooks"}
        style={{
          width: "100%",
          padding: "8px 0",
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.02)",
          color: "rgba(255,255,255,0.5)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {loading === "hooks" ? <Spinner /> : "🔄"} Regenerate
      </button>
    </div>
  );

  const renderChapters = () => (
    <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
      {chapters.map((ch, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            marginBottom: 4,
            border: `1px solid ${BORDER}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: ACCENT,
              fontWeight: 700,
              minWidth: 36,
            }}
          >
            {formatTimestamp(ch.timestamp)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {ch.title}
            </div>
            {ch.summary && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {ch.summary}
              </div>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={addChaptersToTimeline}
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 8,
          minHeight: 36,
        }}
      >
        📑 Add Chapter Markers to Timeline
      </button>
      <button
        onClick={generateChapters}
        disabled={loading === "chapters"}
        style={{
          width: "100%",
          padding: "8px 0",
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.02)",
          color: "rgba(255,255,255,0.5)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 4,
        }}
      >
        {loading === "chapters" ? <Spinner /> : "🔄"} Regenerate
      </button>
    </div>
  );

  const renderVirality = () => {
    if (!viralityResult) return null;
    const statusIcon: Record<string, string> = { good: "✅", warning: "⚠️", bad: "❌" };
    const statusColor: Record<string, string> = {
      good: "#22c55e",
      warning: "#f59e0b",
      bad: "#ef4444",
    };

    return (
      <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
        {/* Score display */}
        <div
          style={{
            textAlign: "center",
            padding: "16px",
            borderRadius: 12,
            background: "rgba(139,92,246,0.06)",
            border: `1px solid rgba(139,92,246,0.2)`,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {viralityResult.score}
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>/100</span>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 2 }}>
            {"⭐".repeat(viralityResult.stars)}
            {"☆".repeat(5 - viralityResult.stars)}
          </div>
        </div>

        {/* Breakdown */}
        {viralityResult.breakdown &&
          Object.entries(viralityResult.breakdown).map(([key, item]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                marginBottom: 4,
                border: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{statusIcon[item.status] || "•"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: statusColor[item.status] || "#fff" }}>
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} ({item.score}/{item.max})
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{item.note}</div>
              </div>
              {/* Mini bar */}
              <div style={{ width: 50, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(item.score / item.max) * 100}%`,
                    borderRadius: 2,
                    background: statusColor[item.status] || ACCENT,
                  }}
                />
              </div>
            </div>
          ))}

        {/* Tips */}
        {viralityResult.tips && viralityResult.tips.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Recommendations
            </div>
            {viralityResult.tips.map((tip, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.02)",
                  marginBottom: 3,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ flexShrink: 0 }}>{tip.icon}</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={analyzeVirality}
          disabled={loading === "virality"}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 8,
          }}
        >
          {loading === "virality" ? <Spinner /> : "🔄"} Re-analyze
        </button>
      </div>
    );
  };

  const renderTranslate = () => (
    <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
      {/* Language selector */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Target Language
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setSelectedLang(lang.code);
                setTranslations([]);
                setTranslationApplied(false);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: `1px solid ${selectedLang === lang.code ? ACCENT : BORDER}`,
                background: selectedLang === lang.code ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
                color: selectedLang === lang.code ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span>{lang.flag}</span>
              <span>{lang.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Translate button */}
      {translations.length === 0 && (
        <button
          onClick={translateCaptions}
          disabled={loading === "translate"}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading === "translate" ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 36,
          }}
        >
          {loading === "translate" ? <Spinner /> : "🌍"} Translate All
        </button>
      )}

      {/* Translation preview */}
      {translations.length > 0 && (
        <>
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "rgba(0,0,0,0.2)",
              marginBottom: 8,
            }}
          >
            {translations.map((t, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 10px",
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.4)" }}>&ldquo;{t.original}&rdquo;</span>
                <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 6px" }}>→</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>&ldquo;{t.translated}&rdquo;</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {!translationApplied ? (
              <button
                onClick={applyTranslation}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                ✅ Apply Translation
              </button>
            ) : (
              <button
                onClick={revertTranslation}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: `1px solid rgba(239,68,68,0.3)`,
                  background: "rgba(239,68,68,0.06)",
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                ↩ Revert to Original
              </button>
            )}
            <button
              onClick={translateCaptions}
              disabled={loading === "translate"}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.02)",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              {loading === "translate" ? <Spinner /> : "🔄"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderHighlight = () => (
    <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
      {/* Duration selector */}
      {highlightClips.length === 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Duration
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {([30, 60] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setHighlightDuration(d)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: `1px solid ${highlightDuration === d ? ACCENT : BORDER}`,
                    background: highlightDuration === d ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                    color: highlightDuration === d ? "#fff" : "rgba(255,255,255,0.5)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateHighlight}
            disabled={loading === "highlight"}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: loading === "highlight" ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 36,
            }}
          >
            {loading === "highlight" ? <Spinner /> : "🎬"} Generate Highlight
          </button>
        </>
      )}

      {/* Highlight clips preview */}
      {highlightClips.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
            }}
          >
            {highlightClips.length} clips selected (
            {Math.round(highlightClips.reduce((sum, c) => sum + (c.end - c.start), 0))}s total)
          </div>
          {highlightClips.map((clip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                marginBottom: 4,
                border: `1px solid ${BORDER}`,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: ACCENT,
                  fontWeight: 700,
                  minWidth: 70,
                }}
              >
                {formatTimestamp(clip.start)}-{formatTimestamp(clip.end)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{clip.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{clip.reason}</div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background:
                    clip.importance === "high"
                      ? "rgba(239,68,68,0.15)"
                      : clip.importance === "medium"
                        ? "rgba(245,158,11,0.15)"
                        : "rgba(255,255,255,0.05)",
                  color:
                    clip.importance === "high"
                      ? "#ef4444"
                      : clip.importance === "medium"
                        ? "#f59e0b"
                        : "rgba(255,255,255,0.4)",
                }}
              >
                {clip.importance}
              </span>
            </div>
          ))}

          <button
            onClick={createHighlightTimeline}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 8,
              minHeight: 36,
            }}
          >
            🎬 Create Highlight Timeline
          </button>
          <button
            onClick={() => {
              setHighlightClips([]);
              generateHighlight();
            }}
            disabled={loading === "highlight"}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.02)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            {loading === "highlight" ? <Spinner /> : "🔄"} Regenerate
          </button>
        </>
      )}
    </div>
  );

  const renderSeo = () => {
    if (!seoResult) return null;

    const CopyButton = ({ text, field }: { text: string; field: string }) => (
      <button
        onClick={() => copyToClipboard(text, field)}
        style={{
          padding: "3px 8px",
          borderRadius: 4,
          border: `1px solid ${BORDER}`,
          background: copiedField === field ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.02)",
          color: copiedField === field ? "#22c55e" : "rgba(255,255,255,0.5)",
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        {copiedField === field ? "✓ Copied" : "📋 Copy"}
      </button>
    );

    return (
      <div style={{ padding: "12px 0", animation: "slide-up 0.3s ease" }}>
        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Title
            </span>
            <CopyButton text={seoResult.title} field="title" />
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${BORDER}`,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.4,
            }}
          >
            {seoResult.title}
          </div>
          {seoResult.titleAlternatives && seoResult.titleAlternatives.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {seoResult.titleAlternatives.map((alt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 12px",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  <span>Alt {i + 1}: {alt}</span>
                  <CopyButton text={alt} field={`alt-${i}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Description
            </span>
            <CopyButton text={seoResult.description} field="description" />
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${BORDER}`,
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            {seoResult.description}
          </div>
        </div>

        {/* Hashtags */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Hashtags
            </span>
            <CopyButton text={seoResult.hashtags.join(" ")} field="hashtags" />
          </div>
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${BORDER}`,
            }}
          >
            {seoResult.hashtags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  color: ACCENT,
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tags
            </span>
            <CopyButton text={seoResult.tags.join(", ")} field="tags" />
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${BORDER}`,
              fontSize: 12,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
            }}
          >
            {seoResult.tags.join(", ")}
          </div>
        </div>

        <button
          onClick={generateSeo}
          disabled={loading === "seo"}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {loading === "seo" ? <Spinner /> : "🔄"} Regenerate
        </button>
      </div>
    );
  };

  // ═════════════════════════════════════════════════════
  // MAIN RENDER
  // ═════════════════════════════════════════════════════

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 22 }}>🧠</span>
        <div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              margin: 0,
            }}
          >
            Smart AI
          </h3>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              margin: 0,
            }}
          >
            AI-powered video optimization
          </p>
        </div>
      </div>

      {/* No transcript warning */}
      {(!transcript || transcript.trim().length < 10) && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            marginBottom: 12,
            fontSize: 12,
            color: "#f59e0b",
            lineHeight: 1.5,
          }}
        >
          ⚠️ Transkripcija nėra arba per trumpa. AI features reikia transkripcijos.
        </div>
      )}

      {/* Feature buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SectionButton
          icon="🎣"
          label="Hook Generator"
          section="hooks"
          onClick={generateHooks}
          hasResults={hooks.length > 0}
        />
        <SectionButton
          icon="📑"
          label="Auto Chapters"
          section="chapters"
          onClick={generateChapters}
          hasResults={chapters.length > 0}
        />
        <SectionButton
          icon="📊"
          label="Virality Score"
          section="virality"
          onClick={analyzeVirality}
          hasResults={viralityResult !== null}
        />
        <SectionButton
          icon="🌍"
          label="Translate Captions"
          section="translate"
          onClick={() => setActiveSection("translate")}
          hasResults={translations.length > 0}
        />
        <SectionButton
          icon="🎬"
          label="AI Highlight Reel"
          section="highlight"
          onClick={() => setActiveSection("highlight")}
          hasResults={highlightClips.length > 0}
        />
        <SectionButton
          icon="🔍"
          label="SEO Optimizer"
          section="seo"
          onClick={generateSeo}
          hasResults={seoResult !== null}
        />
      </div>

      {/* Active section content */}
      {activeSection === "hooks" && hooks.length > 0 && renderHooks()}
      {activeSection === "chapters" && chapters.length > 0 && renderChapters()}
      {activeSection === "virality" && renderVirality()}
      {activeSection === "translate" && renderTranslate()}
      {activeSection === "highlight" && renderHighlight()}
      {activeSection === "seo" && renderSeo()}
    </div>
  );
}
