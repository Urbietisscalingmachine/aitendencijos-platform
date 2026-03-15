"use client";

/* ═══════════════════════════════════════════════════════════
   ExportModal — Cineflow Video Export UI
   Dark glassmorphism modal with progress tracking
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef } from "react";
import type { TranscriptSegment, CaptionStyle } from "@/types/cineflow";
import {
  exportVideoWithSubtitles,
  exportWithEffects,
  type ExportResult,
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
}: ExportModalProps) {
  // Settings
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(!!musicUrl);
  const [includeEffects, setIncludeEffects] = useState(!!colorGrading);

  // Progress
  const [stage, setStage] = useState<ExportStage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const cancelledRef = useRef(false);

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
    setErrorMessage("");

    try {
      const useAdvanced = (includeMusic && musicUrl) || includeEffects;

      let exportResult: ExportResult;

      if (useAdvanced) {
        exportResult = await exportWithEffects({
          videoUrl,
          segments: includeSubtitles ? segments : [],
          captionStyle,
          resolution,
          aspectRatio: "9:16", // default for Reels/TikTok
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
          aspectRatio: "9:16",
          onProgress: updateProgress,
        });
      }

      if (!cancelledRef.current) {
        setResult(exportResult);
        setStage("done");
        setProgress(100);
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
  }, []);

  // ── Download ──
  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `cineflow-export-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  if (!isOpen) return null;

  const isExporting = stage === "loading" || stage === "processing" || stage === "encoding";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border p-6"
        style={{
          backgroundColor: "rgba(9, 9, 11, 0.85)",
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
        <h2
          className="text-xl font-bold mb-6"
          style={{ color: "#f4f4f5" }}
        >
          🎬 Export Video
        </h2>

        {/* ── Settings ── */}
        {stage === "idle" && (
          <div className="space-y-5">
            {/* Resolution */}
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

            {/* Format */}
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

            {/* Include checkboxes */}
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

            {/* Export button */}
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
              Export Video
            </button>
          </div>
        )}

        {/* ── Progress ── */}
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

            {/* Progress bar */}
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

        {/* ── Done ── */}
        {stage === "done" && result && (
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
                {formatFileSize(result.size)} · MP4
              </p>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
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

        {/* ── Error ── */}
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
