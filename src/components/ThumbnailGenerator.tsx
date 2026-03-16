"use client";

import React, { useState, useCallback, useRef } from "react";
import type { ThumbnailResult, ThumbnailTextSuggestion, TranscriptSegment } from "@/types/cineflow";

const ACCENT = "#8B5CF6";
const BORDER = "rgba(255,255,255,0.08)";

// Client-side thumbnail rendering with Canvas API
function renderThumbnailCanvas(
  videoEl: HTMLVideoElement,
  text: string,
  subtitle: string,
  emotion: string
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  // Draw video frame
  ctx.drawImage(videoEl, 0, 0, 1280, 720);

  // Slight darkening overlay for text readability
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, "rgba(0,0,0,0.3)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.05)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.1)");
  grad.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Emotion-based accent
  const emotionColors: Record<string, string> = {
    shocked: "#ef4444",
    happy: "#f59e0b",
    curious: "#6366f1",
    serious: "#e2e8f0",
    excited: "#22c55e",
  };
  const accentColor = emotionColors[emotion] || "#fff";

  // Main title text
  ctx.textAlign = "left";
  ctx.font = "bold 68px Impact, Arial Black, sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.fillStyle = "#fff";

  // Word wrap
  const maxWidth = 1100;
  const words = text.split(" ");
  let line = "";
  let y = 120;
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line + (line ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  for (const l of lines) {
    ctx.strokeText(l, 60, y);
    ctx.fillText(l, 60, y);
    y += 78;
  }

  // Subtitle text
  if (subtitle) {
    ctx.font = "bold 36px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = accentColor;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(subtitle, 60, y + 20);
    ctx.fillText(subtitle, 60, y + 20);
  }

  // Accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(60, y + 40, 100, 5);

  return canvas.toDataURL("image/jpeg", 0.95);
}

// Extract key frames from video at specific timestamps
async function captureFrameAt(videoEl: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      videoEl.removeEventListener("seeked", handler);
      // Small delay to ensure frame is rendered
      setTimeout(resolve, 50);
    };
    videoEl.addEventListener("seeked", handler);
    videoEl.currentTime = time;
  });
}

interface ThumbnailGeneratorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  transcript: TranscriptSegment[];
  videoDuration: number;
}

export default function ThumbnailGenerator({
  videoRef,
  transcript,
  videoDuration,
}: ThumbnailGeneratorProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedThumbId, setSelectedThumbId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [posterSet, setPosterSet] = useState(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const generateThumbnails = useCallback(async () => {
    const video = videoRef.current;
    if (!video || videoDuration <= 0) return;

    setGenerating(true);
    setThumbnails([]);
    setPosterSet(false);

    try {
      // 1. Get text suggestions from API (or generate defaults)
      let suggestions: ThumbnailTextSuggestion[] = [];
      const fullText = transcript.map((s) => s.text).join(" ");

      if (fullText.length > 10) {
        try {
          const res = await fetch("/api/smart-features", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              feature: "thumbnail",
              transcript: fullText,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.suggestions && Array.isArray(data.suggestions)) {
              suggestions = data.suggestions;
            }
          }
        } catch {
          console.error("[thumbnail] API call failed, using defaults");
        }
      }

      // Fallback suggestions
      if (suggestions.length === 0) {
        const truncText = fullText.substring(0, 60).trim() || "Watch This";
        suggestions = [
          { title: truncText, subtitle: "Nepatikėsi...", emotion: "shocked" },
          { title: truncText, subtitle: "Viskas pasikeitė", emotion: "serious" },
          { title: truncText, subtitle: "Štai kaip!", emotion: "curious" },
          { title: truncText, subtitle: "🔥 Must Watch", emotion: "excited" },
          { title: truncText, subtitle: "Tai — geriausia!", emotion: "happy" },
        ];
      }

      // 2. Pick 5 interesting timestamps
      const frameTimes: number[] = [];
      if (transcript.length >= 5) {
        // Use timestamps from key moments in transcript
        const step = Math.floor(transcript.length / 5);
        for (let i = 0; i < 5; i++) {
          const seg = transcript[Math.min(i * step, transcript.length - 1)];
          frameTimes.push(seg.start + (seg.end - seg.start) * 0.5);
        }
      } else {
        // Even distribution across video
        for (let i = 0; i < 5; i++) {
          frameTimes.push((videoDuration * (i + 1)) / 6);
        }
      }

      // 3. Capture frames and render thumbnails
      const results: ThumbnailResult[] = [];
      const wasPlaying = !video.paused;
      if (wasPlaying) video.pause();
      const origTime = video.currentTime;

      for (let i = 0; i < Math.min(5, suggestions.length); i++) {
        const suggestion = suggestions[i];
        const frameTime = frameTimes[i] || videoDuration * 0.3;

        await captureFrameAt(video, frameTime);

        const dataUrl = renderThumbnailCanvas(
          video,
          suggestion.title,
          suggestion.subtitle,
          suggestion.emotion
        );

        results.push({
          id: `thumb-${i}`,
          dataUrl,
          text: suggestion.title,
          subtitle: suggestion.subtitle,
          emotion: suggestion.emotion,
          frameTime,
          selected: i === 0,
        });
      }

      // Restore video position
      video.currentTime = origTime;
      if (wasPlaying) video.play();

      setThumbnails(results);
      setSelectedThumbId(results[0]?.id || null);
    } catch (err) {
      console.error("[thumbnail] Generation failed:", err);
    }

    setGenerating(false);
  }, [videoRef, transcript, videoDuration]);

  const handleDownload = useCallback(
    (thumb: ThumbnailResult) => {
      const link = downloadRef.current;
      if (!link) return;
      link.href = thumb.dataUrl;
      link.download = `thumbnail-${thumb.id}.jpg`;
      link.click();
    },
    []
  );

  const handleSetPoster = useCallback(() => {
    const selected = thumbnails.find((t) => t.id === selectedThumbId);
    if (!selected || !videoRef.current) return;
    videoRef.current.poster = selected.dataUrl;
    setPosterSet(true);
  }, [thumbnails, selectedThumbId, videoRef]);

  const handleEditSave = useCallback(
    (thumbId: string) => {
      const video = videoRef.current;
      if (!video) return;

      setThumbnails((prev) =>
        prev.map((t) => {
          if (t.id !== thumbId) return t;
          const newText = editText || t.text;
          // Re-render with new text
          const origTime = video.currentTime;
          // We need to seek to the frame time, but we can't async in setState
          // So we'll re-render with current frame as approximation
          const dataUrl = renderThumbnailCanvas(video, newText, t.subtitle, t.emotion);
          return { ...t, text: newText, dataUrl };
        })
      );
      setEditingId(null);
      setEditText("");
    },
    [editText, videoRef]
  );

  const handleRegenerateThumb = useCallback(
    async (thumbId: string) => {
      const video = videoRef.current;
      const thumb = thumbnails.find((t) => t.id === thumbId);
      if (!video || !thumb) return;

      const wasPlaying = !video.paused;
      if (wasPlaying) video.pause();

      await captureFrameAt(video, thumb.frameTime);
      const dataUrl = renderThumbnailCanvas(video, thumb.text, thumb.subtitle, thumb.emotion);

      setThumbnails((prev) => prev.map((t) => (t.id === thumbId ? { ...t, dataUrl } : t)));

      if (wasPlaying) video.play();
    },
    [videoRef, thumbnails]
  );

  return (
    <div style={{ padding: "16px" }}>
      {/* Hidden download link */}
      <a ref={downloadRef} style={{ display: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>🖼️</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>AI Thumbnails</h3>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.5 }}>
        AI sugeneruoja 5 thumbnails su click-bait tekstu iš tavo video turinio.
      </p>

      {/* Generate button */}
      {thumbnails.length === 0 && (
        <button
          onClick={generateThumbnails}
          disabled={generating}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            border: "none",
            background: generating
              ? "rgba(139,92,246,0.2)"
              : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: generating ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {generating ? (
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
              Generating 5 Thumbnails...
            </>
          ) : (
            "🖼️ Generate 5 Thumbnails"
          )}
        </button>
      )}

      {/* Thumbnail grid */}
      {thumbnails.length > 0 && (
        <div style={{ animation: "slide-up 0.3s ease" }}>
          {/* Thumbnail strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {thumbnails.map((thumb) => (
              <div
                key={thumb.id}
                onClick={() => setSelectedThumbId(thumb.id)}
                style={{
                  position: "relative",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: `2px solid ${selectedThumbId === thumb.id ? ACCENT : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: selectedThumbId === thumb.id ? `0 0 12px rgba(139,92,246,0.3)` : "none",
                }}
              >
                <img
                  src={thumb.dataUrl}
                  alt={`Thumbnail ${thumb.id}`}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {selectedThumbId === thumb.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: ACCENT,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
                  </div>
                )}

                {/* Edit / Refresh buttons */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    gap: 4,
                    padding: "4px",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(thumb.id);
                      setEditText(thumb.text);
                    }}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "none",
                      background: "rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegenerateThumb(thumb.id);
                    }}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "none",
                      background: "rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    🔄
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit dialog */}
          {editingId && (
            <div
              style={{
                padding: "12px",
                borderRadius: 10,
                border: `1px solid ${ACCENT}`,
                background: "rgba(139,92,246,0.05)",
                marginBottom: 12,
              }}
            >
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
                Edit Thumbnail Text
              </label>
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEditSave(editingId);
                  if (e.key === "Escape") setEditingId(null);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleEditSave(editingId)}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 6,
                    border: "none",
                    background: ACCENT,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${BORDER}`,
                    background: "transparent",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const sel = thumbnails.find((t) => t.id === selectedThumbId);
                if (sel) handleDownload(sel);
              }}
              disabled={!selectedThumbId}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                color: selectedThumbId ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedThumbId ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              💾 Download
            </button>
            <button
              onClick={handleSetPoster}
              disabled={!selectedThumbId || posterSet}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border: "none",
                background: posterSet
                  ? "rgba(34,197,94,0.15)"
                  : selectedThumbId
                    ? `linear-gradient(135deg, ${ACCENT}, #7C3AED)`
                    : "rgba(255,255,255,0.05)",
                color: posterSet ? "#22c55e" : selectedThumbId ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedThumbId && !posterSet ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {posterSet ? "✅ Poster Set" : "🎬 Set as Poster"}
            </button>
          </div>

          {/* Regenerate all */}
          <button
            onClick={() => {
              setThumbnails([]);
              setPosterSet(false);
              setTimeout(generateThumbnails, 100);
            }}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.02)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            🔄 Regenerate All
          </button>
        </div>
      )}
    </div>
  );
}
