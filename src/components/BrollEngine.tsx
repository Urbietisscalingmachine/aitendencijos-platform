"use client";

/* ═══════════════════════════════════════════════════════════
   BrollEngine — AI-powered B-Roll management component
   Pexels search · Multi-model AI generation · AI suggestions
   Models: Kling 3.0, Sora 2, Veo 3.1 (via WaveSpeed)
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useRef, useEffect } from "react";
import type {
  BrollSuggestion,
  BrollClip,
  TranscriptSegment,
} from "@/types/cineflow";

// ─── Types ──────────────────────────────────────────────

type TabId = "suggestions" | "search" | "generate";
type OverlayMode = "fullscreen" | "pip" | "split";
type ModelId = "kling-3.0" | "sora-2" | "veo-3.1";

type ShotType = "close-up" | "aerial" | "tracking" | "dolly" | "macro" | "wide";
type Lighting = "golden hour" | "neon" | "moody" | "high-key" | "dramatic shadow";
type Camera = "shallow DOF" | "lens flare" | "anamorphic" | "handheld" | "steadicam";
type Movement = "slow-mo" | "timelapse" | "parallax" | "orbit";
type StylePreset = "cinematic" | "urban" | "nature" | "tech" | "corporate" | "dramatic";

interface BrollEngineProps {
  transcript: TranscriptSegment[];
  suggestions: BrollSuggestion[];
  onAddClip: (clip: BrollClip, timestamp: number) => void;
  aspectRatio?: "16:9" | "9:16";
}

interface ModelOption {
  id: ModelId;
  icon: string;
  name: string;
  tagline: string;
  price: string;
  badge: string;
  badgeColor: string;
  description: string;
}

// ─── Constants ──────────────────────────────────────────

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "kling-3.0",
    icon: "🎬",
    name: "Kling 3.0",
    tagline: "Fast & Affordable",
    price: "$0.50/clip",
    badge: "RECOMMENDED",
    badgeColor: "#22c55e",
    description:
      "Fast generation with good quality. Best for quick iterations and budget-friendly production. ~30-60s generation time.",
  },
  {
    id: "sora-2",
    icon: "✨",
    name: "Sora 2",
    tagline: "Premium Quality",
    price: "$0.75/clip",
    badge: "POPULAR",
    badgeColor: "#8B5CF6",
    description:
      "OpenAI's latest video model. Excellent motion coherence and photorealism. ~60-120s generation time.",
  },
  {
    id: "veo-3.1",
    icon: "🎥",
    name: "Veo 3.1",
    tagline: "Maximum Quality",
    price: "$1.50/clip",
    badge: "BEST",
    badgeColor: "#f59e0b",
    description:
      "Google's flagship video model with prompt enhancement. Maximum fidelity and cinematic output. ~60-180s generation time.",
  },
];

const SHOT_TYPES: ShotType[] = ["close-up", "aerial", "tracking", "dolly", "macro", "wide"];
const LIGHTINGS: Lighting[] = ["golden hour", "neon", "moody", "high-key", "dramatic shadow"];
const CAMERAS: Camera[] = ["shallow DOF", "lens flare", "anamorphic", "handheld", "steadicam"];
const MOVEMENTS: Movement[] = ["slow-mo", "timelapse", "parallax", "orbit"];
const STYLE_PRESETS: StylePreset[] = ["cinematic", "urban", "nature", "tech", "corporate", "dramatic"];
const OVERLAY_MODES: { value: OverlayMode; label: string; icon: string }[] = [
  { value: "fullscreen", label: "Fullscreen", icon: "⬜" },
  { value: "pip", label: "Picture-in-Picture", icon: "◰" },
  { value: "split", label: "Split Screen", icon: "◧" },
];

const TAB_CONFIG: { id: TabId; label: string; icon: string }[] = [
  { id: "suggestions", label: "AI Suggestions", icon: "✨" },
  { id: "search", label: "Pexels Search", icon: "🔍" },
  { id: "generate", label: "AI Generate", icon: "🎬" },
];

// ─── Helpers ────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getModelSourceLabel(source: string): string {
  switch (source) {
    case "kling":
      return "🎬 Kling 3.0";
    case "sora":
      return "✨ Sora 2";
    case "veo":
      return "🎥 Veo 3.1";
    case "pexels":
      return "📦 Pexels";
    default:
      return "🤖 AI";
  }
}

// ─── Component ──────────────────────────────────────────

export default function BrollEngine({
  transcript,
  suggestions,
  onAddClip,
  aspectRatio = "16:9",
}: BrollEngineProps) {
  const [activeTab, setActiveTab] = useState<TabId>("suggestions");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("fullscreen");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BrollClip[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);

  // Generate state
  const [genPrompt, setGenPrompt] = useState("");
  const [genStyle, setGenStyle] = useState<StylePreset>("cinematic");
  const [genShotType, setGenShotType] = useState<ShotType>("wide");
  const [genLighting, setGenLighting] = useState<Lighting>("golden hour");
  const [genCamera, setGenCamera] = useState<Camera>("shallow DOF");
  const [genMovement, setGenMovement] = useState<Movement>("slow-mo");
  const [genModel, setGenModel] = useState<ModelId>("kling-3.0");
  const [genLoading, setGenLoading] = useState(false);
  const [generatedClip, setGeneratedClip] = useState<BrollClip | null>(null);
  const [genResult, setGenResult] = useState<{
    model: string;
    estimatedCost: string;
  } | null>(null);

  // Preview modal state
  const [previewClip, setPreviewClip] = useState<BrollClip | null>(null);
  const [previewTimestamp, setPreviewTimestamp] = useState(0);

  // Hover preview
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Tooltip state
  const [hoveredModelId, setHoveredModelId] = useState<ModelId | null>(null);

  // ── Pexels Search ─────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch("/api/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), perPage: 12 }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("Search error:", data.error);
        return;
      }
      setSearchResults(data.clips || []);
      setSearchTotal(data.total || 0);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // ── AI Generation (multi-model) ───────────────────────

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim()) return;
    setGenLoading(true);
    setGeneratedClip(null);
    setGenResult(null);
    try {
      const res = await fetch("/api/broll-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: genPrompt.trim(),
          duration: 5,
          style: genStyle,
          aspectRatio,
          model: genModel,
          shotType: genShotType,
          lighting: genLighting,
          camera: genCamera,
          movement: genMovement,
        }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("Generate error:", data.error);
        return;
      }
      if (data.clip) {
        setGeneratedClip(data.clip);
      }
      if (data.model && data.estimatedCost) {
        setGenResult({ model: data.model, estimatedCost: data.estimatedCost });
      }
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setGenLoading(false);
    }
  }, [genPrompt, genStyle, aspectRatio, genModel, genShotType, genLighting, genCamera, genMovement]);

  // ── Quick search from suggestion ──────────────────────

  const handleSuggestionSearch = useCallback(
    (suggestion: BrollSuggestion) => {
      setSearchQuery(suggestion.pexelsQuery);
      setActiveTab("search");
      // Auto-search
      setTimeout(async () => {
        setSearchLoading(true);
        try {
          const res = await fetch("/api/broll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: suggestion.pexelsQuery,
              perPage: 12,
            }),
          });
          const data = await res.json();
          setSearchResults(data.clips || []);
          setSearchTotal(data.total || 0);
        } catch (err) {
          console.error("Quick search failed:", err);
        } finally {
          setSearchLoading(false);
        }
      }, 100);
    },
    []
  );

  const handleSuggestionGenerate = useCallback(
    (suggestion: BrollSuggestion) => {
      setGenPrompt(suggestion.cinematicPrompt);
      setGenShotType(suggestion.shotType);
      setActiveTab("generate");
    },
    []
  );

  // ── Add clip with overlay mode ────────────────────────

  const addClipToTimeline = useCallback(
    (clip: BrollClip, timestamp: number) => {
      onAddClip({ ...clip, overlayMode }, timestamp);
      setPreviewClip(null);
    },
    [onAddClip, overlayMode]
  );

  // ── Hover preview ─────────────────────────────────────

  useEffect(() => {
    if (hoveredClipId && videoPreviewRef.current) {
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [hoveredClipId]);

  // ── Get selected model info ───────────────────────────

  const selectedModel = MODEL_OPTIONS.find((m) => m.id === genModel) || MODEL_OPTIONS[0];

  // ── Render ────────────────────────────────────────────

  return (
    <div className="broll-engine" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={styles.titleIcon}>🎞️</span> B-Roll Engine
        </h2>

        {/* Overlay Mode Selector */}
        <div style={styles.overlaySelector}>
          <span style={styles.overlayLabel}>Overlay:</span>
          {OVERLAY_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setOverlayMode(mode.value)}
              style={{
                ...styles.overlayBtn,
                ...(overlayMode === mode.value ? styles.overlayBtnActive : {}),
              }}
              title={mode.label}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {/* ── AI SUGGESTIONS ─────────────────────────── */}
        {activeTab === "suggestions" && (
          <div style={styles.suggestionsPanel}>
            {/* Transcript with highlights */}
            <div style={styles.transcriptSection}>
              <h3 style={styles.sectionTitle}>📝 Transcript — B-Roll Moments</h3>
              <div style={styles.transcriptScroll}>
                {transcript.map((segment) => {
                  const matchingSuggestions = suggestions.filter(
                    (s) =>
                      s.timestamp >= segment.start && s.timestamp <= segment.end
                  );
                  const hasMatch = matchingSuggestions.length > 0;

                  return (
                    <div
                      key={segment.id}
                      style={{
                        ...styles.transcriptSegment,
                        ...(hasMatch ? styles.transcriptHighlighted : {}),
                      }}
                    >
                      <span style={styles.timestamp}>
                        {formatTime(segment.start)}
                      </span>
                      <span
                        style={{
                          ...styles.transcriptText,
                          ...(hasMatch ? styles.transcriptTextHighlighted : {}),
                        }}
                      >
                        {segment.text}
                      </span>
                      {hasMatch && (
                        <span style={styles.brollBadge}>B-ROLL</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Suggestion Cards */}
            <div style={styles.suggestionsGrid}>
              <h3 style={styles.sectionTitle}>✨ AI B-Roll Suggestions</h3>
              {suggestions.length === 0 && (
                <p style={styles.emptyState}>
                  No suggestions yet. Transcribe your video first.
                </p>
              )}
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} style={styles.suggestionCard}>
                  <div style={styles.suggestionHeader}>
                    <span style={styles.suggestionTime}>
                      ⏱ {formatTime(suggestion.timestamp)}
                    </span>
                    <span style={styles.suggestionType}>
                      {suggestion.type === "stock" && "📦 Stock"}
                      {suggestion.type === "ai-generated" && "🤖 AI"}
                      {suggestion.type === "screen-recording" && "🖥️ Screen"}
                    </span>
                    <span style={styles.suggestionShot}>
                      🎥 {suggestion.shotType}
                    </span>
                  </div>
                  <p style={styles.suggestionKeyword}>
                    &quot;{suggestion.keyword}&quot;
                  </p>
                  <p style={styles.suggestionPrompt}>
                    {suggestion.cinematicPrompt}
                  </p>
                  <div style={styles.suggestionMeta}>
                    <span style={styles.metaBadge}>{suggestion.mood}</span>
                    <span style={styles.metaBadge}>
                      {suggestion.duration}s
                    </span>
                  </div>
                  <div style={styles.suggestionActions}>
                    <button
                      onClick={() => handleSuggestionSearch(suggestion)}
                      style={styles.btnSecondary}
                    >
                      🔍 Search Pexels
                    </button>
                    <button
                      onClick={() => handleSuggestionGenerate(suggestion)}
                      style={styles.btnPrimary}
                    >
                      🎬 Generate AI
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PEXELS SEARCH ──────────────────────────── */}
        {activeTab === "search" && (
          <div>
            {/* Search Bar */}
            <div style={styles.searchBar}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search stock B-roll videos..."
                style={styles.searchInput}
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                style={styles.searchBtn}
              >
                {searchLoading ? (
                  <span style={styles.spinner}>⟳</span>
                ) : (
                  "🔍 Search"
                )}
              </button>
            </div>

            {searchTotal > 0 && (
              <p style={styles.resultCount}>
                {searchTotal.toLocaleString()} results found
              </p>
            )}

            {/* Results Grid */}
            <div style={styles.videoGrid}>
              {searchResults.map((clip) => (
                <div
                  key={clip.id}
                  style={styles.videoCard}
                  onMouseEnter={() => setHoveredClipId(clip.id)}
                  onMouseLeave={() => setHoveredClipId(null)}
                  onClick={() => {
                    setPreviewClip(clip);
                    setPreviewTimestamp(0);
                  }}
                >
                  <div style={styles.videoThumbWrap}>
                    {hoveredClipId === clip.id ? (
                      <video
                        ref={videoPreviewRef}
                        src={clip.src}
                        style={styles.videoThumb}
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={clip.thumbnail}
                        alt="B-roll thumbnail"
                        style={styles.videoThumb}
                      />
                    )}
                    <span style={styles.durationBadge}>
                      {formatTime(clip.duration)}
                    </span>
                    <div style={styles.videoOverlay}>
                      <span style={styles.playIcon}>▶</span>
                    </div>
                  </div>
                  <div style={styles.videoMeta}>
                    <span style={styles.sourceBadge}>Pexels</span>
                  </div>
                </div>
              ))}
            </div>

            {searchLoading && (
              <div style={styles.loadingOverlay}>
                <div style={styles.loadingSpinner} />
                <p style={styles.loadingText}>Searching Pexels...</p>
              </div>
            )}
          </div>
        )}

        {/* ── AI GENERATE (multi-model) ──────────────── */}
        {activeTab === "generate" && (
          <div style={styles.generatePanel}>
            {/* ── Model Selector ─────────────────────── */}
            <div style={styles.formGroup}>
              <label style={styles.label}>🤖 AI Model</label>
              <div style={styles.modelGrid}>
                {MODEL_OPTIONS.map((model) => {
                  const isSelected = genModel === model.id;
                  const isHovered = hoveredModelId === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => setGenModel(model.id)}
                      onMouseEnter={() => setHoveredModelId(model.id)}
                      onMouseLeave={() => setHoveredModelId(null)}
                      style={{
                        ...styles.modelCard,
                        ...(isSelected ? styles.modelCardSelected : {}),
                        ...(isHovered && !isSelected
                          ? styles.modelCardHovered
                          : {}),
                      }}
                    >
                      {/* Badge */}
                      <span
                        style={{
                          ...styles.modelBadge,
                          background: `${model.badgeColor}20`,
                          color: model.badgeColor,
                          borderColor: `${model.badgeColor}40`,
                        }}
                      >
                        {model.badge}
                      </span>

                      {/* Icon */}
                      <span style={styles.modelIcon}>{model.icon}</span>

                      {/* Name */}
                      <span style={styles.modelName}>{model.name}</span>

                      {/* Tagline */}
                      <span style={styles.modelTagline}>{model.tagline}</span>

                      {/* Price */}
                      <span
                        style={{
                          ...styles.modelPrice,
                          color: isSelected ? "#8B5CF6" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {model.price}
                      </span>

                      {/* Selected indicator */}
                      {isSelected && (
                        <div style={styles.modelSelectedDot}>✓</div>
                      )}

                      {/* Tooltip */}
                      {isHovered && (
                        <div style={styles.modelTooltip}>
                          {model.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prompt Input */}
            <div style={styles.formGroup}>
              <label style={styles.label}>🎯 Video Prompt</label>
              <textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="Describe the B-roll you want to generate..."
                style={styles.textarea}
                rows={3}
              />
            </div>

            {/* Style Presets */}
            <div style={styles.formGroup}>
              <label style={styles.label}>🎨 Style Preset</label>
              <div style={styles.presetGrid}>
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setGenStyle(preset)}
                    style={{
                      ...styles.presetBtn,
                      ...(genStyle === preset ? styles.presetBtnActive : {}),
                    }}
                  >
                    {preset === "cinematic" && "🎬"}
                    {preset === "urban" && "🏙️"}
                    {preset === "nature" && "🌿"}
                    {preset === "tech" && "💻"}
                    {preset === "corporate" && "🏢"}
                    {preset === "dramatic" && "⚡"}
                    {" "}{preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Cinematic Controls Grid */}
            <div style={styles.cinematicGrid}>
              {/* Shot Type */}
              <div style={styles.formGroup}>
                <label style={styles.labelSmall}>📸 Shot Type</label>
                <select
                  value={genShotType}
                  onChange={(e) => setGenShotType(e.target.value as ShotType)}
                  style={styles.select}
                >
                  {SHOT_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lighting */}
              <div style={styles.formGroup}>
                <label style={styles.labelSmall}>💡 Lighting</label>
                <select
                  value={genLighting}
                  onChange={(e) => setGenLighting(e.target.value as Lighting)}
                  style={styles.select}
                >
                  {LIGHTINGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera */}
              <div style={styles.formGroup}>
                <label style={styles.labelSmall}>🎥 Camera</label>
                <select
                  value={genCamera}
                  onChange={(e) => setGenCamera(e.target.value as Camera)}
                  style={styles.select}
                >
                  {CAMERAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement */}
              <div style={styles.formGroup}>
                <label style={styles.labelSmall}>🔄 Movement</label>
                <select
                  value={genMovement}
                  onChange={(e) => setGenMovement(e.target.value as Movement)}
                  style={styles.select}
                >
                  {MOVEMENTS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cinematic Preview */}
            <div style={styles.cinematicPreview}>
              <span style={styles.cinematicPreviewLabel}>🎬 Generated Prompt:</span>
              <p style={styles.cinematicPreviewText}>
                {genPrompt
                  ? `${genStyle} style, ${genShotType} shot, ${genLighting} lighting, ${genCamera}, ${genMovement} — ${genPrompt}`
                  : "Enter a prompt above to see the cinematic enhancement..."}
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={genLoading || !genPrompt.trim()}
              style={{
                ...styles.generateBtn,
                ...(genLoading || !genPrompt.trim()
                  ? styles.generateBtnDisabled
                  : {}),
              }}
            >
              {genLoading ? (
                <>
                  <span style={styles.spinner}>⟳</span> Generating with {selectedModel.name}...
                </>
              ) : (
                <>
                  {selectedModel.icon} Generate B-Roll — {selectedModel.name}{" "}
                  <span style={styles.generateBtnPrice}>({selectedModel.price})</span>
                </>
              )}
            </button>

            {/* Generated Result */}
            {generatedClip && (
              <div style={styles.generatedResult}>
                <h4 style={styles.resultTitle}>✅ Generated Video</h4>
                {genResult && (
                  <div style={styles.resultMeta}>
                    <span style={styles.resultMetaBadge}>
                      {getModelSourceLabel(generatedClip.source)}
                    </span>
                    <span style={styles.resultMetaCost}>
                      Est. cost: {genResult.estimatedCost}
                    </span>
                  </div>
                )}
                <div style={styles.generatedPreview}>
                  <video
                    src={generatedClip.src}
                    style={styles.generatedVideo}
                    controls
                    muted
                    loop
                    playsInline
                  />
                  <button
                    onClick={() => {
                      setPreviewClip(generatedClip);
                      setPreviewTimestamp(0);
                    }}
                    style={styles.btnPrimary}
                  >
                    ➕ Add to Timeline
                  </button>
                </div>
              </div>
            )}

            {genLoading && (
              <div style={styles.generatingState}>
                <div style={styles.loadingSpinner} />
                <p style={styles.loadingText}>
                  {selectedModel.icon} {selectedModel.name} is generating your cinematic B-roll...
                </p>
                <p style={styles.loadingSubtext}>
                  {genModel === "kling-3.0"
                    ? "This may take 30-60 seconds"
                    : genModel === "sora-2"
                      ? "This may take 60-120 seconds"
                      : "This may take 60-180 seconds"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Preview Modal ────────────────────────────── */}
      {previewClip && (
        <div style={styles.modal} onClick={() => setPreviewClip(null)}>
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewClip(null)}
              style={styles.modalClose}
            >
              ✕
            </button>
            <video
              src={previewClip.src}
              style={styles.modalVideo}
              controls
              autoPlay
              muted
              loop
              playsInline
            />
            <div style={styles.modalActions}>
              <div style={styles.modalInfo}>
                <span style={styles.sourceBadge}>
                  {getModelSourceLabel(previewClip.source)}
                </span>
                <span style={styles.durationText}>
                  {formatTime(previewClip.duration)}
                </span>
              </div>

              {/* Overlay mode selector in modal */}
              <div style={styles.modalOverlay}>
                {OVERLAY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setOverlayMode(mode.value)}
                    style={{
                      ...styles.overlayBtn,
                      ...(overlayMode === mode.value
                        ? styles.overlayBtnActive
                        : {}),
                    }}
                  >
                    {mode.icon} {mode.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  addClipToTimeline(previewClip, previewTimestamp)
                }
                style={styles.addToTimelineBtn}
              >
                ➕ Add to Timeline ({OVERLAY_MODES.find((m) => m.value === overlayMode)?.label})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#09090b",
    borderRadius: 16,
    border: "1px solid rgba(139, 92, 246, 0.15)",
    overflow: "hidden",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  titleIcon: {
    fontSize: 24,
  },
  overlaySelector: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  overlayLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginRight: 4,
  },
  overlayBtn: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  overlayBtnActive: {
    color: "#fff",
    background: "rgba(139, 92, 246, 0.2)",
    borderColor: "rgba(139, 92, 246, 0.5)",
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tab: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 14,
    fontWeight: 500,
    color: "rgba(255,255,255,0.5)",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#8B5CF6",
    borderBottomColor: "#8B5CF6",
    background: "rgba(139, 92, 246, 0.05)",
  },
  tabContent: {
    padding: 24,
    minHeight: 400,
  },

  // ── Suggestions ─────────────────────────────────────
  suggestionsPanel: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  transcriptSection: {},
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
    marginTop: 0,
  },
  transcriptScroll: {
    maxHeight: 420,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    paddingRight: 8,
  },
  transcriptSegment: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 8,
    transition: "all 0.2s",
  },
  transcriptHighlighted: {
    background: "rgba(139, 92, 246, 0.08)",
    border: "1px solid rgba(139, 92, 246, 0.2)",
  },
  timestamp: {
    fontSize: 11,
    fontWeight: 600,
    color: "#8B5CF6",
    fontFamily: "monospace",
    minWidth: 40,
    paddingTop: 2,
  },
  transcriptText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.5,
    flex: 1,
  },
  transcriptTextHighlighted: {
    color: "rgba(255,255,255,0.9)",
  },
  brollBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: "#8B5CF6",
    background: "rgba(139, 92, 246, 0.15)",
    padding: "2px 6px",
    borderRadius: 4,
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
  },
  suggestionsGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  emptyState: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    textAlign: "center" as const,
    padding: 40,
  },
  suggestionCard: {
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))",
    border: "1px solid rgba(139, 92, 246, 0.12)",
    borderRadius: 12,
    padding: 16,
    backdropFilter: "blur(20px)",
  },
  suggestionHeader: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap" as const,
  },
  suggestionTime: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8B5CF6",
  },
  suggestionType: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.05)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  suggestionShot: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.05)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  suggestionKeyword: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    margin: "4px 0",
  },
  suggestionPrompt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.4,
    margin: "4px 0 8px",
  },
  suggestionMeta: {
    display: "flex",
    gap: 6,
    marginBottom: 12,
  },
  metaBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.06)",
    padding: "3px 8px",
    borderRadius: 6,
    textTransform: "capitalize" as const,
  },
  suggestionActions: {
    display: "flex",
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnPrimary: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // ── Search ──────────────────────────────────────────
  searchBar: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    padding: "12px 16px",
    fontSize: 14,
    color: "#fff",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    outline: "none",
    fontFamily: "inherit",
  },
  searchBtn: {
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap" as const,
  },
  resultCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  videoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  videoCard: {
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  videoThumbWrap: {
    position: "relative" as const,
    aspectRatio: "16 / 9",
    overflow: "hidden",
  },
  videoThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  durationBadge: {
    position: "absolute" as const,
    bottom: 6,
    right: 6,
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(0,0,0,0.75)",
    padding: "2px 6px",
    borderRadius: 4,
    fontFamily: "monospace",
  },
  videoOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0)",
    transition: "all 0.2s",
    opacity: 0,
  },
  playIcon: {
    fontSize: 32,
    color: "#fff",
    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  videoMeta: {
    padding: "8px 10px",
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#8B5CF6",
    background: "rgba(139, 92, 246, 0.1)",
    padding: "2px 8px",
    borderRadius: 4,
  },

  // ── Model Selector ──────────────────────────────────
  modelGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  modelCard: {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 6,
    padding: "20px 16px 16px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.25s ease",
    backdropFilter: "blur(20px)",
    textAlign: "center" as const,
  },
  modelCardSelected: {
    border: "1.5px solid rgba(139, 92, 246, 0.7)",
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))",
    boxShadow:
      "0 0 24px rgba(139, 92, 246, 0.15), 0 0 48px rgba(139, 92, 246, 0.05)",
  },
  modelCardHovered: {
    border: "1px solid rgba(139, 92, 246, 0.3)",
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))",
  },
  modelBadge: {
    position: "absolute" as const,
    top: -8,
    right: 12,
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  modelIcon: {
    fontSize: 28,
    lineHeight: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: -0.2,
  },
  modelTagline: {
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.2,
  },
  modelPrice: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 2,
  },
  modelSelectedDot: {
    position: "absolute" as const,
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(139, 92, 246, 0.4)",
  },
  modelTooltip: {
    position: "absolute" as const,
    bottom: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 220,
    padding: "10px 14px",
    fontSize: 11,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.85)",
    background: "rgba(18, 18, 21, 0.95)",
    border: "1px solid rgba(139, 92, 246, 0.25)",
    borderRadius: 10,
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    zIndex: 10,
    pointerEvents: "none" as const,
  },

  // ── Generate ────────────────────────────────────────
  generatePanel: {
    maxWidth: 700,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  labelSmall: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 6,
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 14,
    color: "#fff",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  presetGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  presetBtn: {
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  presetBtnActive: {
    color: "#fff",
    background: "rgba(139, 92, 246, 0.2)",
    borderColor: "rgba(139, 92, 246, 0.5)",
    boxShadow: "0 0 12px rgba(139, 92, 246, 0.15)",
  },
  cinematicGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    color: "#fff",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  cinematicPreview: {
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))",
    border: "1px solid rgba(139, 92, 246, 0.15)",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 16,
    backdropFilter: "blur(20px)",
  },
  cinematicPreviewLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#8B5CF6",
  },
  cinematicPreviewText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.5,
    margin: "6px 0 0",
  },
  generateBtn: {
    width: "100%",
    padding: "14px 24px",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
  },
  generateBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  generateBtnPrice: {
    opacity: 0.7,
    fontWeight: 500,
  },
  generatedResult: {
    marginTop: 20,
    padding: 16,
    background: "rgba(34, 197, 94, 0.06)",
    border: "1px solid rgba(34, 197, 94, 0.2)",
    borderRadius: 12,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#22c55e",
    margin: "0 0 8px",
  },
  resultMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  resultMetaBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "#8B5CF6",
    background: "rgba(139, 92, 246, 0.12)",
    padding: "3px 10px",
    borderRadius: 6,
  },
  resultMetaCost: {
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.45)",
  },
  generatedPreview: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    alignItems: "center",
  },
  generatedVideo: {
    width: "100%",
    maxHeight: 300,
    borderRadius: 8,
    background: "#000",
  },
  generatingState: {
    marginTop: 20,
    textAlign: "center" as const,
    padding: 40,
  },

  // ── Loading ─────────────────────────────────────────
  loadingOverlay: {
    textAlign: "center" as const,
    padding: 40,
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(139, 92, 246, 0.2)",
    borderTopColor: "#8B5CF6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 12px",
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  loadingSubtext: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    marginTop: 4,
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },

  // ── Modal ───────────────────────────────────────────
  modal: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    position: "relative" as const,
    width: "100%",
    maxWidth: 720,
    background: "#121215",
    borderRadius: 16,
    border: "1px solid rgba(139, 92, 246, 0.2)",
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
  },
  modalClose: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    fontSize: 16,
    color: "#fff",
    background: "rgba(0,0,0,0.5)",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalVideo: {
    width: "100%",
    maxHeight: 400,
    background: "#000",
    display: "block",
  },
  modalActions: {
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  modalInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  durationText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "monospace",
  },
  modalOverlay: {
    display: "flex",
    gap: 6,
  },
  addToTimelineBtn: {
    width: "100%",
    padding: "14px 24px",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
  },
};
