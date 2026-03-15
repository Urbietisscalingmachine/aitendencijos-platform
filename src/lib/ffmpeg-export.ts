/* ═══════════════════════════════════════════════════════════
   FFmpeg WASM Export Engine — Cineflow
   Runs entirely client-side in the browser
   Multi-format export with smart crop/pad
   ═══════════════════════════════════════════════════════════ */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { TranscriptSegment, CaptionStyle } from "@/types/cineflow";

// ─── Types ──────────────────────────────────────────────

export type AspectRatio = "9:16" | "16:9" | "1:1";

export interface ExportOptions {
  videoUrl: string;
  segments: TranscriptSegment[];
  captionStyle: CaptionStyle;
  resolution: "720p" | "1080p";
  aspectRatio: AspectRatio;
  onProgress: (percent: number) => void;
}

export interface ExportWithEffectsOptions extends ExportOptions {
  colorGrading?: string;
  zoomKeyframes?: { time: number; scale: number }[];
  musicUrl?: string;
  musicVolume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ExportResult {
  url: string;
  blob: Blob;
  size: number;
}

export interface MultiFormatExportOptions {
  videoUrl: string;
  segments: TranscriptSegment[];
  captionStyle: CaptionStyle;
  resolution: "720p" | "1080p";
  formats: AspectRatio[];
  originalAspectRatio: AspectRatio;
  colorGrading?: string;
  zoomKeyframes?: { time: number; scale: number }[];
  musicUrl?: string;
  musicVolume?: number;
  fadeIn?: number;
  fadeOut?: number;
  includeSubtitles: boolean;
  includeMusic: boolean;
  includeEffects: boolean;
  /** Called with overall percent (0-100) */
  onProgress: (percent: number) => void;
  /** Called with per-format status updates */
  onFormatProgress?: (info: {
    currentFormat: AspectRatio;
    currentIndex: number;
    totalFormats: number;
    formatPercent: number;
  }) => void;
}

export interface MultiFormatExportResult {
  format: AspectRatio;
  url: string;
  blob: Blob;
  size: number;
}

// ─── Singleton FFmpeg instance ──────────────────────────

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

const CORE_CDN = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

export async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  const coreURL = await toBlobURL(`${CORE_CDN}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`, "application/wasm");

  await ffmpeg.load({ coreURL, wasmURL });

  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;

  return ffmpeg;
}

// ─── Resolution helpers ─────────────────────────────────

function getResolutionDimensions(
  resolution: "720p" | "1080p",
  aspectRatio: AspectRatio
): { width: number; height: number } {
  if (aspectRatio === "9:16") {
    return resolution === "1080p"
      ? { width: 1080, height: 1920 }
      : { width: 720, height: 1280 };
  }
  if (aspectRatio === "1:1") {
    return resolution === "1080p"
      ? { width: 1080, height: 1080 }
      : { width: 720, height: 720 };
  }
  // 16:9
  return resolution === "1080p"
    ? { width: 1920, height: 1080 }
    : { width: 1280, height: 720 };
}

// ─── Color conversion helpers ───────────────────────────

/** CSS hex #RRGGBB → ASS &HBBGGRR& */
function cssColorToASS(cssColor: string): string {
  const hex = cssColor.replace("#", "").replace(/^0x/, "");
  if (hex.length < 6) return "&H00FFFFFF&";
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/** CSS hex #RRGGBB → ASS &HAABBGGRR& with alpha (00=opaque, FF=transparent) */
function cssColorToASSWithAlpha(cssColor: string | undefined, alpha: string = "00"): string {
  if (!cssColor) return `&H${alpha}000000&`;
  const hex = cssColor.replace("#", "").replace(/^0x/, "");
  if (hex.length < 6) return `&H${alpha}000000&`;
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H${alpha}${b}${g}${r}&`.toUpperCase();
}

/** Parse CSS text-shadow to extract offset/depth */
function parseTextShadow(shadow: string | undefined): number {
  if (!shadow || shadow === "none") return 0;
  const match = shadow.match(/([\d.]+)px/);
  return match ? Math.round(parseFloat(match[1])) : 2;
}

/** Parse CSS stroke to get color and width: "2px #000000" */
function parseStroke(stroke: string | undefined): { color: string; width: number } {
  if (!stroke) return { color: "&H00000000&", width: 0 };
  const widthMatch = stroke.match(/([\d.]+)px/);
  const colorMatch = stroke.match(/#[0-9a-fA-F]{6}/);
  return {
    color: colorMatch ? cssColorToASS(colorMatch[0]) : "&H00000000&",
    width: widthMatch ? Math.round(parseFloat(widthMatch[1])) : 2,
  };
}

/** Position to ASS Alignment number */
function positionToAlignment(position: "top" | "center" | "bottom"): number {
  switch (position) {
    case "top": return 8;
    case "center": return 5;
    case "bottom": return 2;
    default: return 2;
  }
}

/** Format seconds to ASS timestamp: H:MM:SS.CC */
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// ─── ASS Subtitle Generation ───────────────────────────

export function generateASSSubtitles(
  segments: TranscriptSegment[],
  style: CaptionStyle,
  targetAspectRatio?: AspectRatio
): string {
  const strokeInfo = parseStroke(style.stroke);
  const shadowDepth = parseTextShadow(style.textShadow);
  const alignment = positionToAlignment(style.position);

  const scaledFontSize = Math.round(style.fontSize * 1.5);

  const isBold = style.fontWeight >= 700 ? -1 : 0;
  const isItalic = 0;

  const hasBg = !!style.backgroundColor;
  const borderStyle = hasBg ? 3 : 1;
  const backColor = hasBg
    ? cssColorToASSWithAlpha(style.backgroundColor, "80")
    : "&H80000000&";

  const primaryColor = cssColorToASS(style.color);
  const secondaryColor = style.highlightColor
    ? cssColorToASS(style.highlightColor)
    : primaryColor;
  const outlineColor = strokeInfo.width > 0 ? strokeInfo.color : "&H00000000&";
  const outlineWidth = strokeInfo.width > 0 ? strokeInfo.width : (hasBg ? 0 : 2);

  // Adjust PlayRes and margins based on target aspect ratio
  let playResX = 1920;
  let playResY = 1080;
  let marginL = 40;
  let marginR = 40;
  let marginV = 60;

  if (targetAspectRatio === "9:16") {
    playResX = 1080;
    playResY = 1920;
    marginL = 30;
    marginR = 30;
    marginV = 120; // more bottom margin for 9:16
  } else if (targetAspectRatio === "1:1") {
    playResX = 1080;
    playResY = 1080;
    marginL = 30;
    marginR = 30;
    marginV = 50;
  }

  const scriptInfo = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "Title: Cineflow Export",
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
  ].join("\n");

  const styleLine = [
    "Default",
    style.fontFamily.split(",")[0].trim().replace(/['"]/g, ""),
    scaledFontSize,
    primaryColor,
    secondaryColor,
    outlineColor,
    backColor,
    isBold,
    isItalic,
    0,
    0,
    100,
    100,
    0,
    0,
    borderStyle,
    outlineWidth,
    shadowDepth,
    alignment,
    marginL,
    marginR,
    marginV,
    1,
  ].join(",");

  const styles = [
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: ${styleLine}`,
    "",
  ].join("\n");

  const events: string[] = [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const segment of segments) {
    const startTime = formatASSTime(segment.start);
    const endTime = formatASSTime(segment.end);

    let text = segment.text;

    if (style.textTransform === "uppercase") {
      text = text.toUpperCase();
    } else if (style.textTransform === "lowercase") {
      text = text.toLowerCase();
    }

    if (style.animation === "karaoke" && segment.words && segment.words.length > 0) {
      const karaokeText = segment.words
        .map((word) => {
          const durationCs = Math.round((word.end - word.start) * 100);
          let w = word.word;
          if (style.textTransform === "uppercase") w = w.toUpperCase();
          else if (style.textTransform === "lowercase") w = w.toLowerCase();
          return `{\\k${durationCs}}${w}`;
        })
        .join(" ");
      events.push(
        `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${karaokeText}`
      );
    } else {
      let overrideTags = "";

      switch (style.animation) {
        case "fade":
          overrideTags = "{\\fad(300,300)}";
          break;
        case "pop":
          overrideTags = "{\\fscx0\\fscy0\\t(0,150,\\fscx100\\fscy100)}";
          break;
        case "bounce":
          overrideTags = `{\\move(${playResX / 2},${playResY * 0.56},${playResX / 2},${playResY * 0.5})\\fad(200,200)}`;
          break;
        case "slide":
          overrideTags = `{\\move(-200,${playResY * 0.5},${playResX / 2},${playResY * 0.5})\\fad(0,200)}`;
          break;
        default:
          break;
      }

      events.push(
        `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${overrideTags}${text}`
      );
    }
  }

  return [scriptInfo, styles, events.join("\n"), ""].join("\n");
}

// ─── Smart crop/pad filter for format conversion ────────

function buildSmartCropPadFilter(
  originalAspect: AspectRatio,
  targetAspect: AspectRatio,
  targetWidth: number,
  targetHeight: number
): string[] {
  const filters: string[] = [];

  // Same aspect — simple scale + pad
  if (originalAspect === targetAspect) {
    filters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
    filters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`);
    return filters;
  }

  // 16:9 → 9:16: center crop sides + scale up
  if (originalAspect === "16:9" && targetAspect === "9:16") {
    // Crop center portion (9:16 from 16:9)
    filters.push(`crop=ih*9/16:ih`);
    filters.push(`scale=${targetWidth}:${targetHeight}`);
    return filters;
  }

  // 9:16 → 16:9: pad sides with blurred background
  if (originalAspect === "9:16" && targetAspect === "16:9") {
    // Complex filter: blurred background + overlay original
    // Using split → blur → overlay approach
    filters.push(`split[bg][fg]`);
    filters.push(`[bg]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:20[bgblur]`);
    filters.push(`[fg]scale=-1:${targetHeight}:force_original_aspect_ratio=decrease[fgscaled]`);
    filters.push(`[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2`);
    return filters;
  }

  // 1:1 → 9:16: pad top/bottom with blurred background
  if (originalAspect === "1:1" && targetAspect === "9:16") {
    filters.push(`split[bg][fg]`);
    filters.push(`[bg]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:20[bgblur]`);
    filters.push(`[fg]scale=${targetWidth}:-1:force_original_aspect_ratio=decrease[fgscaled]`);
    filters.push(`[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2`);
    return filters;
  }

  // 1:1 → 16:9: pad sides with blurred background
  if (originalAspect === "1:1" && targetAspect === "16:9") {
    filters.push(`split[bg][fg]`);
    filters.push(`[bg]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:20[bgblur]`);
    filters.push(`[fg]scale=-1:${targetHeight}:force_original_aspect_ratio=decrease[fgscaled]`);
    filters.push(`[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2`);
    return filters;
  }

  // 16:9 → 1:1: center crop
  if (originalAspect === "16:9" && targetAspect === "1:1") {
    filters.push(`crop=ih:ih`);
    filters.push(`scale=${targetWidth}:${targetHeight}`);
    return filters;
  }

  // 9:16 → 1:1: center crop
  if (originalAspect === "9:16" && targetAspect === "1:1") {
    filters.push(`crop=iw:iw`);
    filters.push(`scale=${targetWidth}:${targetHeight}`);
    return filters;
  }

  // Fallback: simple scale + pad
  filters.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`);
  return filters;
}

/**
 * Check if smart crop/pad uses split (complex filtergraph).
 * If so, we need to use -filter_complex instead of -vf.
 */
function usesComplexFilter(originalAspect: AspectRatio, targetAspect: AspectRatio): boolean {
  // These combos use split → blur → overlay
  if (originalAspect === "9:16" && targetAspect === "16:9") return true;
  if (originalAspect === "1:1" && targetAspect === "9:16") return true;
  if (originalAspect === "1:1" && targetAspect === "16:9") return true;
  return false;
}

// ─── Main export: video + subtitles ─────────────────────

export async function exportVideoWithSubtitles(
  options: ExportOptions
): Promise<ExportResult> {
  const {
    videoUrl,
    segments,
    captionStyle,
    resolution,
    aspectRatio,
    onProgress,
  } = options;

  onProgress(5);

  const ffmpeg = await initFFmpeg();
  onProgress(15);

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(15 + Math.round(progress * 75), 90);
    onProgress(pct);
  });

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);
  onProgress(25);

  const assContent = generateASSSubtitles(segments, captionStyle, aspectRatio);
  const encoder = new TextEncoder();
  await ffmpeg.writeFile("subtitles.ass", encoder.encode(assContent));
  onProgress(30);

  const { width, height } = getResolutionDimensions(resolution, aspectRatio);

  const filterParts: string[] = [];
  filterParts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
  filterParts.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
  filterParts.push("ass=subtitles.ass");

  const vf = filterParts.join(",");

  await ffmpeg.exec([
    "-i", "input.mp4",
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "copy",
    "-movflags", "+faststart",
    "output.mp4",
  ]);

  onProgress(92);

  const outputData = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  await ffmpeg.deleteFile("input.mp4").catch(() => {});
  await ffmpeg.deleteFile("subtitles.ass").catch(() => {});
  await ffmpeg.deleteFile("output.mp4").catch(() => {});

  onProgress(100);

  return { url, blob, size: blob.size };
}

// ─── Advanced export with effects ───────────────────────

export async function exportWithEffects(
  options: ExportWithEffectsOptions
): Promise<ExportResult> {
  const {
    videoUrl,
    segments,
    captionStyle,
    colorGrading,
    zoomKeyframes,
    musicUrl,
    musicVolume = 0.3,
    fadeIn,
    fadeOut,
    resolution,
    aspectRatio,
    onProgress,
  } = options;

  onProgress(5);

  const ffmpeg = await initFFmpeg();
  onProgress(10);

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(10 + Math.round(progress * 80), 90);
    onProgress(pct);
  });

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);
  onProgress(18);

  const hasMusic = !!musicUrl;
  if (hasMusic) {
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile("music.mp3", musicData);
  }
  onProgress(22);

  const assContent = generateASSSubtitles(segments, captionStyle, aspectRatio);
  const encoder = new TextEncoder();
  await ffmpeg.writeFile("subtitles.ass", encoder.encode(assContent));
  onProgress(25);

  const { width, height } = getResolutionDimensions(resolution, aspectRatio);

  const videoFilters: string[] = [];

  videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
  videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);

  if (colorGrading) {
    const eqParts: string[] = [];
    const brightnessMatch = colorGrading.match(/brightness\(([\d.]+)\)/);
    const contrastMatch = colorGrading.match(/contrast\(([\d.]+)\)/);
    const saturateMatch = colorGrading.match(/saturate\(([\d.]+)\)/);
    const hueMatch = colorGrading.match(/hue-rotate\(([\d.]+)deg\)/);

    if (brightnessMatch) {
      const val = parseFloat(brightnessMatch[1]) - 1;
      eqParts.push(`brightness=${val.toFixed(2)}`);
    }
    if (contrastMatch) {
      eqParts.push(`contrast=${parseFloat(contrastMatch[1]).toFixed(2)}`);
    }
    if (saturateMatch) {
      eqParts.push(`saturation=${parseFloat(saturateMatch[1]).toFixed(2)}`);
    }

    if (eqParts.length > 0) {
      videoFilters.push(`eq=${eqParts.join(":")}`);
    }
    if (hueMatch) {
      videoFilters.push(`hue=h=${parseFloat(hueMatch[1])}`);
    }
  }

  if (zoomKeyframes && zoomKeyframes.length > 0) {
    const maxScale = Math.max(...zoomKeyframes.map((k) => k.scale));
    const minScale = Math.min(...zoomKeyframes.map((k) => k.scale));
    const avgScale = (maxScale + minScale) / 2;
    videoFilters.push(
      `zoompan=z='${avgScale.toFixed(2)}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`
    );
  }

  videoFilters.push("ass=subtitles.ass");

  const args: string[] = ["-i", "input.mp4"];

  if (hasMusic) {
    args.push("-i", "music.mp3");
  }

  args.push("-vf", videoFilters.join(","));

  if (hasMusic) {
    let audioFilter = `[0:a][1:a]amix=inputs=2:duration=first:weights=1 ${musicVolume}`;

    if (fadeIn && fadeIn > 0) {
      audioFilter += `[amixed];[amixed]afade=t=in:d=${fadeIn}`;
    }

    if (fadeOut && fadeOut > 0) {
      const lastSegment = segments[segments.length - 1];
      const approxDuration = lastSegment ? lastSegment.end + 2 : 60;
      const fadeOutStart = Math.max(0, approxDuration - fadeOut);
      if (fadeIn && fadeIn > 0) {
        audioFilter += `,afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
      } else {
        audioFilter += `[amixed];[amixed]afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
      }
    }

    args.push("-filter_complex", audioFilter);
    args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
  } else {
    if (fadeIn || fadeOut) {
      const audioFilters: string[] = [];
      if (fadeIn && fadeIn > 0) {
        audioFilters.push(`afade=t=in:d=${fadeIn}`);
      }
      if (fadeOut && fadeOut > 0) {
        const lastSegment = segments[segments.length - 1];
        const approxDuration = lastSegment ? lastSegment.end + 2 : 60;
        const fadeOutStart = Math.max(0, approxDuration - fadeOut);
        audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOut}`);
      }
      args.push("-af", audioFilters.join(","));
    } else {
      args.push("-c:a", "copy");
    }

    args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
  }

  args.push("-movflags", "+faststart", "output.mp4");

  await ffmpeg.exec(args);
  onProgress(92);

  const outputData = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  await ffmpeg.deleteFile("input.mp4").catch(() => {});
  await ffmpeg.deleteFile("subtitles.ass").catch(() => {});
  await ffmpeg.deleteFile("output.mp4").catch(() => {});
  if (hasMusic) await ffmpeg.deleteFile("music.mp3").catch(() => {});

  onProgress(100);

  return { url, blob, size: blob.size };
}

// ─── Multi-format export ────────────────────────────────

/**
 * Export video in multiple aspect ratios simultaneously.
 * Each format gets its own FFmpeg pass with smart crop/pad
 * and repositioned subtitles.
 */
export async function exportMultiFormat(
  options: MultiFormatExportOptions
): Promise<MultiFormatExportResult[]> {
  const {
    videoUrl,
    segments,
    captionStyle,
    resolution,
    formats,
    originalAspectRatio,
    colorGrading,
    musicUrl,
    musicVolume = 0.3,
    includeSubtitles,
    includeMusic,
    includeEffects,
    onProgress,
    onFormatProgress,
  } = options;

  const results: MultiFormatExportResult[] = [];
  const totalFormats = formats.length;

  onProgress(2);

  // Init FFmpeg once
  const ffmpeg = await initFFmpeg();
  onProgress(5);

  // Write input video once
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);
  onProgress(10);

  // Write music once if needed
  const hasMusic = includeMusic && !!musicUrl;
  if (hasMusic) {
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile("music.mp3", musicData);
  }
  onProgress(12);

  // Process each format sequentially
  for (let i = 0; i < totalFormats; i++) {
    const format = formats[i];
    const formatIndex = i + 1;

    // Progress range for this format: spread evenly across 12% → 95%
    const rangeStart = 12 + (i / totalFormats) * 83;
    const rangeEnd = 12 + ((i + 1) / totalFormats) * 83;

    // Hook up ffmpeg progress for this format
    const progressHandler = ({ progress }: { progress: number }) => {
      const formatPct = Math.round(progress * 100);
      const overallPct = Math.min(
        Math.round(rangeStart + (progress * (rangeEnd - rangeStart))),
        Math.round(rangeEnd)
      );
      onProgress(overallPct);
      onFormatProgress?.({
        currentFormat: format,
        currentIndex: formatIndex,
        totalFormats,
        formatPercent: formatPct,
      });
    };

    ffmpeg.on("progress", progressHandler);

    try {
      const { width, height } = getResolutionDimensions(resolution, format);

      // Generate ASS subtitles repositioned for this format
      if (includeSubtitles && segments.length > 0) {
        const assContent = generateASSSubtitles(segments, captionStyle, format);
        const encoder = new TextEncoder();
        await ffmpeg.writeFile("subtitles.ass", encoder.encode(assContent));
      }

      // Build filter chain
      const isComplex = usesComplexFilter(originalAspectRatio, format);
      const cropPadFilters = buildSmartCropPadFilter(
        originalAspectRatio,
        format,
        width,
        height
      );

      const outputFile = `output_${format.replace(":", "x")}.mp4`;

      if (isComplex) {
        // Complex filtergraph: split → blur → overlay + subtitles
        // We need to build a full -filter_complex string
        let filterComplex = `[0:v]${cropPadFilters.join(";")}`;

        // Add color grading
        if (includeEffects && colorGrading) {
          const eqParts: string[] = [];
          const brightnessMatch = colorGrading.match(/brightness\(([\d.]+)\)/);
          const contrastMatch = colorGrading.match(/contrast\(([\d.]+)\)/);
          const saturateMatch = colorGrading.match(/saturate\(([\d.]+)\)/);

          if (brightnessMatch) {
            eqParts.push(`brightness=${(parseFloat(brightnessMatch[1]) - 1).toFixed(2)}`);
          }
          if (contrastMatch) {
            eqParts.push(`contrast=${parseFloat(contrastMatch[1]).toFixed(2)}`);
          }
          if (saturateMatch) {
            eqParts.push(`saturation=${parseFloat(saturateMatch[1]).toFixed(2)}`);
          }
          if (eqParts.length > 0) {
            filterComplex += `,eq=${eqParts.join(":")}`;
          }
        }

        // Add subtitles burn-in
        if (includeSubtitles && segments.length > 0) {
          filterComplex += `,ass=subtitles.ass`;
        }

        filterComplex += `[vout]`;

        const args: string[] = ["-i", "input.mp4"];
        if (hasMusic) args.push("-i", "music.mp3");

        args.push("-filter_complex", filterComplex);
        args.push("-map", "[vout]");

        // Audio
        if (hasMusic) {
          args.push("-filter_complex", `[0:a][1:a]amix=inputs=2:duration=first:weights=1 ${musicVolume}[aout]`);
          args.push("-map", "[aout]");
        } else {
          args.push("-map", "0:a?");
          args.push("-c:a", "copy");
        }

        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
        args.push("-movflags", "+faststart", outputFile);

        await ffmpeg.exec(args);
      } else {
        // Simple filtergraph: scale/crop/pad + effects + subtitles
        const videoFilters: string[] = [...cropPadFilters];

        // Color grading
        if (includeEffects && colorGrading) {
          const eqParts: string[] = [];
          const brightnessMatch = colorGrading.match(/brightness\(([\d.]+)\)/);
          const contrastMatch = colorGrading.match(/contrast\(([\d.]+)\)/);
          const saturateMatch = colorGrading.match(/saturate\(([\d.]+)\)/);

          if (brightnessMatch) {
            eqParts.push(`brightness=${(parseFloat(brightnessMatch[1]) - 1).toFixed(2)}`);
          }
          if (contrastMatch) {
            eqParts.push(`contrast=${parseFloat(contrastMatch[1]).toFixed(2)}`);
          }
          if (saturateMatch) {
            eqParts.push(`saturation=${parseFloat(saturateMatch[1]).toFixed(2)}`);
          }
          if (eqParts.length > 0) {
            videoFilters.push(`eq=${eqParts.join(":")}`);
          }
        }

        // Subtitles (last)
        if (includeSubtitles && segments.length > 0) {
          videoFilters.push("ass=subtitles.ass");
        }

        const args: string[] = ["-i", "input.mp4"];
        if (hasMusic) args.push("-i", "music.mp3");

        args.push("-vf", videoFilters.join(","));

        // Audio
        if (hasMusic) {
          const audioFilter = `[0:a][1:a]amix=inputs=2:duration=first:weights=1 ${musicVolume}`;
          args.push("-filter_complex", audioFilter);
        } else {
          args.push("-c:a", "copy");
        }

        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
        args.push("-movflags", "+faststart", outputFile);

        await ffmpeg.exec(args);
      }

      // Read output
      const outputData = await ffmpeg.readFile(outputFile);
      const blob = new Blob([new Uint8Array(outputData as Uint8Array)], {
        type: "video/mp4",
      });
      const url = URL.createObjectURL(blob);

      results.push({
        format,
        url,
        blob,
        size: blob.size,
      });

      // Cleanup this format's output
      await ffmpeg.deleteFile(outputFile).catch(() => {});
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  }

  // Final cleanup
  await ffmpeg.deleteFile("input.mp4").catch(() => {});
  await ffmpeg.deleteFile("subtitles.ass").catch(() => {});
  if (hasMusic) await ffmpeg.deleteFile("music.mp3").catch(() => {});

  onProgress(100);

  return results;
}
