"use client";

/* ═══════════════════════════════════════════════════════════
   AUDIO WAVEFORM — Canvas-based reusable waveform display
   Web Audio API decoding, zoom, seek, silence highlighting
   ═══════════════════════════════════════════════════════════ */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { SilenceSegment } from "@/types/cineflow";

// ── Props ────────────────────────────────────────────────
export interface AudioWaveformProps {
  audioUrl: string;
  width?: number;
  height?: number;
  color?: string;
  highlightColor?: string;
  silenceRegions?: SilenceSegment[];
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  onWaveformReady?: (peaks: Float32Array, duration: number) => void;
  showZoom?: boolean;
  mini?: boolean;
}

// ── Component ────────────────────────────────────────────
export default function AudioWaveform({
  audioUrl,
  width = 800,
  height = 120,
  color = "#8B5CF6",
  highlightColor = "#ef4444",
  silenceRegions = [],
  currentTime = 0,
  duration: propDuration,
  onSeek,
  onWaveformReady,
  showZoom = false,
  mini = false,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioDuration, setAudioDuration] = useState(propDuration || 0);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverX, setHoverX] = useState(0);

  const effectiveDuration = propDuration || audioDuration;

  // ── Decode audio and extract peaks ─────────────────
  useEffect(() => {
    if (!audioUrl) return;

    let cancelled = false;
    const audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const samples = Math.min(channelData.length, width * 4 * zoom);
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j] || 0);
          }
          filteredData[i] = sum / blockSize;
        }

        // Normalize
        const max = Math.max(...filteredData) || 1;
        for (let i = 0; i < filteredData.length; i++) {
          filteredData[i] /= max;
        }

        setPeaks(filteredData);
        setAudioDuration(audioBuffer.duration);
        onWaveformReady?.(filteredData, audioBuffer.duration);
      } catch (e) {
        console.error("[AudioWaveform] Decode error:", e);
        // Generate placeholder peaks
        if (!cancelled) {
          const placeholder = new Float32Array(200);
          for (let i = 0; i < 200; i++) {
            placeholder[i] = 0.1 + Math.random() * 0.6 + Math.sin(i * 0.1) * 0.2;
          }
          setPeaks(placeholder);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
        audioCtx.close();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, width, zoom, onWaveformReady]);

  // ── Generate placeholder peaks if no URL ──────────
  const displayPeaks = useMemo(() => {
    if (peaks) return peaks;
    // Generate a nice-looking placeholder
    const p = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      p[i] = 0.15 + Math.random() * 0.5 + Math.sin(i * 0.08) * 0.25;
    }
    return p;
  }, [peaks]);

  // ── Draw waveform ─────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayPeaks) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    const barCount = displayPeaks.length;
    const totalWidth = width * zoom;
    const barWidth = totalWidth / barCount;
    const gap = mini ? 0.5 : 1;
    const centerY = height / 2;

    // Visible range
    const startIdx = Math.floor((scrollOffset / totalWidth) * barCount);
    const endIdx = Math.min(
      barCount,
      Math.ceil(((scrollOffset + width) / totalWidth) * barCount)
    );

    // ── Draw silence regions first (background) ─────
    if (silenceRegions.length > 0 && effectiveDuration > 0) {
      ctx.fillStyle = highlightColor + "20"; // 12% opacity
      for (const region of silenceRegions) {
        const x1 =
          (region.start / effectiveDuration) * totalWidth - scrollOffset;
        const x2 =
          (region.end / effectiveDuration) * totalWidth - scrollOffset;
        if (x2 > 0 && x1 < width) {
          ctx.fillRect(
            Math.max(0, x1),
            0,
            Math.min(x2, width) - Math.max(0, x1),
            height
          );
        }
      }

      // Draw red borders on silence regions
      ctx.strokeStyle = highlightColor + "60";
      ctx.lineWidth = 1;
      for (const region of silenceRegions) {
        const x1 =
          (region.start / effectiveDuration) * totalWidth - scrollOffset;
        const x2 =
          (region.end / effectiveDuration) * totalWidth - scrollOffset;
        if (x2 > 0 && x1 < width) {
          ctx.beginPath();
          ctx.moveTo(Math.max(0, x1), 0);
          ctx.lineTo(Math.max(0, x1), height);
          ctx.moveTo(Math.min(x2, width), 0);
          ctx.lineTo(Math.min(x2, width), height);
          ctx.stroke();
        }
      }
    }

    // ── Draw waveform bars ──────────────────────────
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, color + "DD");
    gradient.addColorStop(1, "#6D28D9");

    for (let i = startIdx; i < endIdx; i++) {
      const amplitude = displayPeaks[i] || 0;
      const barHeight = amplitude * (height - 4);
      const x = i * barWidth - scrollOffset;

      // Check if this bar falls in a silence region
      let inSilence = false;
      if (silenceRegions.length > 0 && effectiveDuration > 0) {
        const time = (i / barCount) * effectiveDuration;
        inSilence = silenceRegions.some(
          (r) => time >= r.start && time <= r.end
        );
      }

      ctx.fillStyle = inSilence ? highlightColor + "80" : gradient;
      const bw = Math.max(barWidth - gap, 1);

      if (mini) {
        // Mini mode: only bottom half
        ctx.fillRect(x, height - barHeight, bw, barHeight);
      } else {
        // Full mode: mirrored
        ctx.fillRect(x, centerY - barHeight / 2, bw, barHeight);
      }
    }

    // ── Draw playhead ───────────────────────────────
    if (effectiveDuration > 0 && currentTime >= 0) {
      const playheadX =
        (currentTime / effectiveDuration) * totalWidth - scrollOffset;
      if (playheadX >= 0 && playheadX <= width) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(playheadX - 1, 0, 2, height);

        // Glow effect
        ctx.shadowColor = "#8B5CF6";
        ctx.shadowBlur = 6;
        ctx.fillRect(playheadX - 0.5, 0, 1, height);
        ctx.shadowBlur = 0;
      }
    }

    // ── Draw hover indicator ────────────────────────
    if (isHovering) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(hoverX - 0.5, 0, 1, height);
    }
  }, [
    displayPeaks,
    width,
    height,
    color,
    highlightColor,
    silenceRegions,
    effectiveDuration,
    currentTime,
    zoom,
    scrollOffset,
    mini,
    isHovering,
    hoverX,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ── Event handlers ────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSeek || !effectiveDuration) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const totalWidth = width * zoom;
      const time = ((x + scrollOffset) / totalWidth) * effectiveDuration;
      onSeek(Math.max(0, Math.min(time, effectiveDuration)));
    },
    [onSeek, effectiveDuration, width, zoom, scrollOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHoverX(e.clientX - rect.left);
    },
    []
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!showZoom) return;
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        setZoom((z) => Math.max(1, Math.min(20, z + (e.deltaY > 0 ? -0.5 : 0.5))));
      } else {
        // Scroll
        const totalWidth = width * zoom;
        const maxScroll = Math.max(0, totalWidth - width);
        setScrollOffset((s) => Math.max(0, Math.min(maxScroll, s + e.deltaX + e.deltaY)));
      }
    },
    [showZoom, width, zoom]
  );

  // ── Render ────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative group"
      style={{ width, height: height + (showZoom ? 32 : 0) }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: "rgba(9,9,11,0.6)" }}
        >
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-1 bg-violet-500 rounded-full animate-pulse"
                style={{
                  height: 12 + Math.random() * 20,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        onWheel={handleWheel}
        style={{
          width,
          height,
          borderRadius: mini ? 4 : 8,
          overflow: "hidden",
          background: mini
            ? "transparent"
            : "linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(9,9,11,0.3) 100%)",
          cursor: onSeek ? "pointer" : "default",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width, height, display: "block" }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        />
      </div>

      {/* Zoom controls */}
      {showZoom && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            className="w-6 h-6 rounded flex items-center justify-center text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <div className="text-[10px] text-zinc-500 min-w-[32px] text-center">
            {zoom.toFixed(1)}×
          </div>
          <button
            onClick={() => setZoom((z) => Math.min(20, z + 1))}
            className="w-6 h-6 rounded flex items-center justify-center text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>
      )}

      {/* Time tooltip on hover */}
      {isHovering && effectiveDuration > 0 && !mini && (
        <div
          className="absolute -top-7 px-2 py-0.5 rounded text-[10px] text-white bg-zinc-800 pointer-events-none whitespace-nowrap"
          style={{
            left: Math.min(Math.max(hoverX, 20), width - 40),
            transform: "translateX(-50%)",
          }}
        >
          {formatTime(
            ((hoverX + scrollOffset) / (width * zoom)) * effectiveDuration
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
