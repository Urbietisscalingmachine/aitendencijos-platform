"use client";

/* ═══════════════════════════════════════════════════════════
   ExportModal — Cineflow Video Export UI
   Dark glassmorphism modal with multi-format export
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef } from "react";
import type { TranscriptSegment, CaptionStyle } from "@/types/cineflow";
import {
  exportVideoWithSubtitles,
  exportWithEffects,
  exportMultiFormat,
  type ExportResult,
  type MultiFormatExportResult,
  type AspectRatio,
} from "@/lib/ffmpeg-export";

// ─── Props ──────────────────────────────────────────────

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  segments: TranscriptSegment[];
  captionStyle: CaptionStyle;
  musicUrl?: string;
  musicVolume?: number;
  colorGrading?: string;
  /** Original aspect ratio of the source video */
  originalAspectRatio?: AspectRatio;
}

// ─── Stage labels ───────────────────────────────────────

type ExportStage = "idle" | "loading" | "processing" | "encoding" | "done" | "error";

const STAGE_LABELS: Record<ExportStage, string> = {
  idle: "Ready to export",
  loading: "Loading FFmpeg…",
  processing: "Processing video…",
  encoding: "Encoding…",
  done: "Export complete!",
  error: "Export failed",
};

// ─── Format card config ─────────────────────────────────

interface FormatCardConfig {
  ratio: AspectRatio;
  label: string;
  emoji: string;
  /** Visual dimensions for the preview rectangle (px) */
  previewW: number;
  previewH: number;
}

const FORMAT_CARDS: FormatCardConfig[] = [
  { ratio: "9:16", label: "Reels", emoji: "📱", previewW: 36, previewH: 64 },
  { ratio: "16:9", label: "YouTube", emoji: "🖥️", previewW: 72, previewH: 40 },
  { ratio: "1:1", label: "Square", emoji: "◻️", previewW: 48, previewH: 48 },
];

// ─── Helpers ────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ──────────────────────────────────────────

export default function ExportModal({
  isOpen,
  onClose,
  videoUrl,
  segments,
  captionStyle,
  musicUrl,
  musicVolume = 0.3,
  colorGrading,
  originalAspectRatio = "9:16",
}: ExportModalProps) {
  // Settings
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(!!musicUrl);
  const [includeEffects, setIncludeEffects] = useState(!!colorGrading);

  // Multi-format selection
  const [selectedFormats, setSelectedFormats] = useState<Set<AspectRatio>>(
    new Set([originalAspectRatio])
  );

  // Progress
  const [stage, setStage] = useState<ExportStage>("idle");
  const [progress, setProgress] = useState(0);
  const [formatStatus, setFormatStatus] = useState<string>("");

  // Results — single or multi
  const [result, setResult] = useState<ExportResult | null>(null);
  const [multiResults, setMultiResults] = useState<MultiFormatExportResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const cancelledRef = useRef(false);

  // ── Format toggle ──
  const toggleFormat = useCallback((ratio: AspectRatio) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(ratio)) {
        // Don't allow deselecting the last one
        if (next.size > 1) next.delete(ratio);
      } else {
        next.add(ratio);
      }
      return next;
    });
  }, []);

  // Derive stage from progress percent
  const updateProgress = useCallback((pct: number) => {
    if (cancelledRef.current) return;
    setProgress(pct);
    if (pct < 15) setStage("loading");
    else if (pct < 90) setStage("processing");
    else if (pct < 100) setStage("encoding");
    else setStage("done");
  }, []);

  // ── Export handler ──
  const handleExport = useCallback(async () => {
    cancelledRef.current = false;
    setStage("loading");
    setProgress(0);
    setResult(null);
    setMultiResults([]);
    setErrorMessage("");
    setFormatStatus("");

    const formats = Array.from(selectedFormats);

    try {
      // Single format path (legacy — simpler, faster)
      if (formats.length === 1) {
        const singleFormat = formats[0];
        const useAdvanced = (includeMusic && musicUrl) || includeEffects;

        let exportResult: ExportResult;

        if (useAdvanced) {
          exportResult = await exportWithEffects({
            videoUrl,
            segments: includeSubtitles ? segments : [],
            captionStyle,
            resolution,
            aspectRatio: singleFormat,
            colorGrading: includeEffects ? colorGrading : undefined,
            musicUrl: includeMusic ? musicUrl : undefined,
            musicVolume,
            onProgress: updateProgress,
          });
        } else {
          exportResult = await exportVideoWithSubtitles({
            videoUrl,
            segments: includeSubtitles ? segments : [],
            captionStyle,
            resolution,
            aspectRatio: singleFormat,
            onProgress: updateProgress,
          });
        }

        if (!cancelledRef.current) {
          setResult(exportResult);
          setStage("done");
          setProgress(100);
        }
      } else {
        // Multi-format path
        const multiExportResults = await exportMultiFormat({
          videoUrl,
          segments,
          captionStyle,
          resolution,
          formats,
          originalAspectRatio,
          colorGrading: includeEffects ? colorGrading : undefined,
          musicUrl: includeMusic ? musicUrl : undefined,
          musicVolume,
          includeSubtitles,
          includeMusic: includeMusic && !!musicUrl,
          includeEffects,
          onProgress: (pct) => {
            if (cancelledRef.current) return;
            setProgress(pct);
            if (pct < 12) setStage("loading");
            else if (pct < 95) setStage("processing");
            else if (pct < 100) setStage("encoding");
            else setStage("done");
          },
          onFormatProgress: ({ currentFormat, currentIndex, totalFormats, formatPercent }) => {
            if (cancelledRef.current) return;
            const card = FORMAT_CARDS.find((c) => c.ratio === currentFormat);
            const label = card ? `${card.emoji} ${card.ratio} ${card.label}` : currentFormat;
            setFormatStatus(
              `Eksportuojama ${currentIndex}/${totalFormats}: ${label}… (${formatPercent}%)`
            );
          },
        });

        if (!cancelledRef.current) {
          setMultiResults(multiExportResults);
          setStage("done");
          setProgress(100);
          setFormatStatus("");
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setStage("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown export error");
      }
    }
  }, [
    videoUrl,
    segments,
    captionStyle,
    resolution,
    selectedFormats,
    originalAspectRatio,
    includeSubtitles,
    includeMusic,
    includeEffects,
    musicUrl,
    musicVolume,
    colorGrading,
    updateProgress,
  ]);

  // ── Cancel ──
  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setStage("idle");
    setProgress(0);
    setFormatStatus("");
  }, []);

  // ── Download single ──
  const handleDownload = useCallback(
    (url: string, format?: AspectRatio) => {
      const a = document.createElement("a");
      a.href = url;
      const suffix = format ? `-${format.replace(":", "x")}` : "";
      a.download = `cineflow-export${suffix}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    []
  );

  // ── Download All (multi) ──
  const handleDownloadAll = useCallback(() => {
    multiResults.forEach((r) => {
      handleDownload(r.url, r.format);
    });
  }, [multiResults, handleDownload]);

  if (!isOpen) return null;

  const isExporting = stage === "loading" || stage === "processing" || stage === "encoding";
  const hasMultiResults = multiResults.length > 1;
  const hasSingleResult = !!result || multiResults.length === 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border p-6 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "rgba(9, 9, 11, 0.9)",
          borderColor: "rgba(139, 92, 246, 0.2)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 0 60px rgba(139, 92, 246, 0.1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isExporting}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold mb-6" style={{ color: "#f4f4f5" }}>
          🎬 Export Video
        </h2>

        {/* ═══════════ SETTINGS ═══════════ */}
        {stage === "idle" && (
          <div className="space-y-5">
            {/* ── Format Selection Cards ── */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: "#a1a1aa" }}>
                Export Formats
              </label>
              <div className="grid grid-cols-3 gap-3">
                {FORMAT_CARDS.map((card) => {
                  const selected = selectedFormats.has(card.ratio);
                  return (
                    <button
                      key={card.ratio}
                      onClick={() => toggleFormat(card.ratio)}
                      className="group relative flex flex-col items-center gap-2 py-4 px-3 rounded-xl border transition-all duration-200"
                      style={{
                        backgroundColor: selected
                          ? "rgba(139, 92, 246, 0.1)"
                          : "rgba(39, 39, 42, 0.4)",
                        borderColor: selected
                          ? "transparent"
                          : "rgba(63, 63, 70, 0.5)",
                        ...(selected
                          ? {
                              backgroundImage:
                                "linear-gradient(rgba(9,9,11,0.9), rgba(9,9,11,0.9)), linear-gradient(135deg, #8B5CF6, #6D28D9, #8B5CF6)",
                              backgroundOrigin: "border-box",
                              backgroundClip: "padding-box, border-box",
                              border: "2px solid transparent",
                            }
                          : {}),
                        boxShadow: selected
                          ? "0 0 20px rgba(139, 92, 246, 0.2), inset 0 0 20px rgba(139, 92, 246, 0.05)"
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) {
                          (e.currentTarget as HTMLElement).style.boxShadow =
                            "0 0 15px rgba(139, 92, 246, 0.15)";
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "rgba(139, 92, 246, 0.3)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) {
                          (e.currentTarget as HTMLElement).style.boxShadow = "none";
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "rgba(63, 63, 70, 0.5)";
                        }
                      }}
                    >
                      {/* Checkbox indicator */}
                      <div
                        className="absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: selected ? "#8B5CF6" : "rgba(113, 113, 122, 0.5)",
                          backgroundColor: selected ? "#8B5CF6" : "transparent",
                        }}
                      >
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2 5L4 7L8 3"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Aspect ratio preview rectangle */}
                      <div
                        className="rounded-md transition-all duration-200"
                        style={{
                          width: card.previewW,
                          height: card.previewH,
                          border: `2px solid ${selected ? "#8B5CF6" : "rgba(113, 113, 122, 0.4)"}`,
                          backgroundColor: selected
                            ? "rgba(139, 92, 246, 0.15)"
                            : "rgba(63, 63, 70, 0.3)",
                          boxShadow: selected
                            ? "inset 0 0 12px rgba(139, 92, 246, 0.2)"
                            : "none",
                        }}
                      />

                      {/* Label */}
                      <div className="text-center">
                        <p
                          className="text-xs font-bold"
                          style={{
                            color: selected ? "#C4B5FD" : "#a1a1aa",
                          }}
                        >
                          {card.ratio}
                        </p>
                        <p
                          className="text-[10px] mt-0.5"
                          style={{
                            color: selected ? "#A78BFA" : "#71717A",
                          }}
                        >
                          {card.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedFormats.size > 1 && (
                <p className="text-[11px] mt-2 text-center" style={{ color: "#71717A" }}>
                  {selectedFormats.size} formatai pasirinkti — kiekvienas bus eksportuotas atskirai
                </p>
              )}
            </div>

            {/* ── Resolution ── */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#a1a1aa" }}>
                Resolution
              </label>
              <div className="flex gap-3">
                {(["720p", "1080p"] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all border"
                    style={{
                      backgroundColor:
                        resolution === res ? "rgba(139, 92, 246, 0.2)" : "rgba(39, 39, 42, 0.5)",
                      borderColor:
                        resolution === res ? "#8B5CF6" : "rgba(63, 63, 70, 0.5)",
                      color: resolution === res ? "#C4B5FD" : "#71717A",
                    }}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Container Format ── */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#a1a1aa" }}>
                Format
              </label>
              <div
                className="py-2 px-3 rounded-lg text-sm border"
                style={{
                  backgroundColor: "rgba(39, 39, 42, 0.5)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  color: "#71717A",
                }}
              >
                MP4 (H.264)
              </div>
            </div>

            {/* ── Include checkboxes ── */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#a1a1aa" }}>
                Include
              </label>
              <div className="space-y-2">
                {[
                  { label: "Subtitles", checked: includeSubtitles, onChange: setIncludeSubtitles },
                  { label: "Music", checked: includeMusic, onChange: setIncludeMusic, disabled: !musicUrl },
                  { label: "Effects", checked: includeEffects, onChange: setIncludeEffects, disabled: !colorGrading },
                ].map(({ label, checked, onChange, disabled }) => (
                  <label
                    key={label}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{ opacity: disabled ? 0.4 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onChange(e.target.checked)}
                      disabled={disabled}
                      className="rounded"
                      style={{ accentColor: "#8B5CF6" }}
                    />
                    <span className="text-sm" style={{ color: "#d4d4d8" }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Export button ── */}
            <button
              onClick={handleExport}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                color: "#ffffff",
                boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.boxShadow =
                  "0 4px 30px rgba(139, 92, 246, 0.5)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.boxShadow =
                  "0 4px 20px rgba(139, 92, 246, 0.3)";
              }}
            >
              {selectedFormats.size > 1
                ? `Export ${selectedFormats.size} Formats`
                : "Export Video"}
            </button>
          </div>
        )}

        {/* ═══════════ PROGRESS ═══════════ */}
        {isExporting && (
          <div className="space-y-4">
            {/* Stage label */}
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#C4B5FD" }}>
                {STAGE_LABELS[stage]}
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#f4f4f5" }}>
                {progress}%
              </p>
            </div>

            {/* Overall progress bar */}
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(39, 39, 42, 0.8)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                }}
              />
            </div>

            {/* Per-format status for multi-export */}
            {formatStatus && (
              <p
                className="text-xs text-center font-medium"
                style={{ color: "#A78BFA" }}
              >
                {formatStatus}
              </p>
            )}

            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="w-full py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: "rgba(63, 63, 70, 0.5)",
                color: "#71717A",
                backgroundColor: "transparent",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ═══════════ DONE — SINGLE RESULT ═══════════ */}
        {stage === "done" && hasSingleResult && !hasMultiResults && (
          <div className="space-y-4 text-center">
            {/* Success icon */}
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-lg font-bold" style={{ color: "#f4f4f5" }}>
                Export Complete!
              </p>
              <p className="text-sm mt-1" style={{ color: "#71717A" }}>
                {formatFileSize(
                  result?.size ?? multiResults[0]?.size ?? 0
                )}{" "}
                · MP4
              </p>
            </div>

            {/* Download button */}
            <button
              onClick={() =>
                handleDownload(
                  result?.url ?? multiResults[0]?.url ?? "",
                  multiResults[0]?.format
                )
              }
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: "#22c55e",
                color: "#ffffff",
                boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#16a34a";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#22c55e";
              }}
            >
              ⬇ Download Video
            </button>

            {/* Export another */}
            <button
              onClick={() => {
                setStage("idle");
                setProgress(0);
                setResult(null);
                setMultiResults([]);
              }}
              className="w-full py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: "rgba(63, 63, 70, 0.5)",
                color: "#a1a1aa",
                backgroundColor: "transparent",
              }}
            >
              Export Again
            </button>
          </div>
        )}

        {/* ═══════════ DONE — MULTI RESULTS ═══════════ */}
        {stage === "done" && hasMultiResults && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold" style={{ color: "#f4f4f5" }}>
                {multiResults.length} Formats Exported!
              </p>
              <p className="text-sm mt-1" style={{ color: "#71717A" }}>
                Total:{" "}
                {formatFileSize(
                  multiResults.reduce((sum, r) => sum + r.size, 0)
                )}
              </p>
            </div>

            {/* Individual download buttons */}
            <div className="space-y-2">
              {multiResults.map((r) => {
                const card = FORMAT_CARDS.find((c) => c.ratio === r.format);
                return (
                  <button
                    key={r.format}
                    onClick={() => handleDownload(r.url, r.format)}
                    className="w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-medium transition-all border group"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.08)",
                      borderColor: "rgba(34, 197, 94, 0.2)",
                      color: "#d4d4d8",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(34, 197, 94, 0.15)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(34, 197, 94, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(34, 197, 94, 0.08)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(34, 197, 94, 0.2)";
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span>{card?.emoji ?? "📹"}</span>
                      <span>
                        Download {r.format} {card?.label ?? ""}
                      </span>
                    </span>
                    <span
                      className="text-xs font-normal"
                      style={{ color: "#71717A" }}
                    >
                      {formatFileSize(r.size)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Download All */}
            <button
              onClick={handleDownloadAll}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: "#22c55e",
                color: "#ffffff",
                boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#16a34a";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#22c55e";
              }}
            >
              📦 Download All ({multiResults.length} files)
            </button>

            {/* Export another */}
            <button
              onClick={() => {
                setStage("idle");
                setProgress(0);
                setResult(null);
                setMultiResults([]);
                setFormatStatus("");
              }}
              className="w-full py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: "rgba(63, 63, 70, 0.5)",
                color: "#a1a1aa",
                backgroundColor: "transparent",
              }}
            >
              Export Again
            </button>
          </div>
        )}

        {/* ═══════════ ERROR ═══════════ */}
        {stage === "error" && (
          <div className="space-y-4 text-center">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18L18 6M6 6l12 12"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-lg font-bold" style={{ color: "#f4f4f5" }}>
                Export Failed
              </p>
              <p className="text-sm mt-1" style={{ color: "#ef4444" }}>
                {errorMessage}
              </p>
            </div>

            <button
              onClick={() => {
                setStage("idle");
                setProgress(0);
                setErrorMessage("");
                setFormatStatus("");
              }}
              className="w-full py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: "rgba(63, 63, 70, 0.5)",
                color: "#a1a1aa",
                backgroundColor: "transparent",
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
