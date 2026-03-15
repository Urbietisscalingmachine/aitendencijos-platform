/* ═══════════════════════════════════════════════════════════
   FFmpeg WASM Export Engine — Cineflow
   Runs entirely client-side in the browser
   ═══════════════════════════════════════════════════════════ */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { TranscriptSegment, CaptionStyle } from "@/types/cineflow";

// ─── Types ──────────────────────────────────────────────

export interface ExportOptions {
  videoUrl: string;
  segments: TranscriptSegment[];
  captionStyle: CaptionStyle;
  resolution: "720p" | "1080p";
  aspectRatio: "9:16" | "16:9";
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
  aspectRatio: "9:16" | "16:9"
): { width: number; height: number } {
  if (aspectRatio === "9:16") {
    return resolution === "1080p"
      ? { width: 1080, height: 1920 }
      : { width: 720, height: 1280 };
  }
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
  // ASS uses &HAABBGGRR& — alpha is 00 for opaque
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
  // e.g. "2px 2px 4px rgba(0,0,0,0.5)"
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
    case "top": return 8;      // top-center
    case "center": return 5;   // middle-center
    case "bottom": return 2;   // bottom-center
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
  style: CaptionStyle
): string {
  const strokeInfo = parseStroke(style.stroke);
  const shadowDepth = parseTextShadow(style.textShadow);
  const alignment = positionToAlignment(style.position);

  // Scale fontSize for typical video resolution
  const scaledFontSize = Math.round(style.fontSize * 1.5);

  const isBold = style.fontWeight >= 700 ? -1 : 0;
  const isItalic = 0; // CaptionStyle doesn't have italic field

  // Background: ASS BorderStyle=3 means opaque box
  const hasBg = !!style.backgroundColor;
  const borderStyle = hasBg ? 3 : 1; // 3=opaque box, 1=outline+shadow
  const backColor = hasBg
    ? cssColorToASSWithAlpha(style.backgroundColor, "80") // semi-transparent bg
    : "&H80000000&";

  const primaryColor = cssColorToASS(style.color);
  const secondaryColor = style.highlightColor
    ? cssColorToASS(style.highlightColor)
    : primaryColor;
  const outlineColor = strokeInfo.width > 0 ? strokeInfo.color : "&H00000000&";
  const outlineWidth = strokeInfo.width > 0 ? strokeInfo.width : (hasBg ? 0 : 2);

  // ── [Script Info] ──
  const scriptInfo = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "Title: Cineflow Export",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
  ].join("\n");

  // ── [V4+ Styles] ──
  // Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,
  //         Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,
  //         BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
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
    0, // Underline
    0, // StrikeOut
    100, // ScaleX
    100, // ScaleY
    0, // Spacing
    0, // Angle
    borderStyle,
    outlineWidth,
    shadowDepth,
    alignment,
    40, // MarginL
    40, // MarginR
    60, // MarginV
    1, // Encoding
  ].join(",");

  const styles = [
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: ${styleLine}`,
    "",
  ].join("\n");

  // ── [Events] ──
  const events: string[] = [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const segment of segments) {
    const startTime = formatASSTime(segment.start);
    const endTime = formatASSTime(segment.end);

    let text = segment.text;

    // Apply text transform
    if (style.textTransform === "uppercase") {
      text = text.toUpperCase();
    } else if (style.textTransform === "lowercase") {
      text = text.toLowerCase();
    }

    // Karaoke animation: use \k tags for word-by-word highlight
    if (style.animation === "karaoke" && segment.words && segment.words.length > 0) {
      const karaokeText = segment.words
        .map((word) => {
          // \k duration is in centiseconds
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
      // Optional per-animation override tags
      let overrideTags = "";

      switch (style.animation) {
        case "fade":
          overrideTags = "{\\fad(300,300)}";
          break;
        case "pop":
          overrideTags = "{\\fscx0\\fscy0\\t(0,150,\\fscx100\\fscy100)}";
          break;
        case "bounce":
          overrideTags = "{\\move(960,600,960,540)\\fad(200,200)}";
          break;
        case "slide":
          overrideTags = "{\\move(-200,540,960,540)\\fad(0,200)}";
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

  // 1. Init FFmpeg
  const ffmpeg = await initFFmpeg();
  onProgress(15);

  // Wire up progress
  ffmpeg.on("progress", ({ progress }) => {
    // progress is 0–1 during encoding
    const pct = Math.min(15 + Math.round(progress * 75), 90);
    onProgress(pct);
  });

  // 2. Write input video to FS
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);
  onProgress(25);

  // 3. Generate and write ASS subtitles
  const assContent = generateASSSubtitles(segments, captionStyle);
  const encoder = new TextEncoder();
  await ffmpeg.writeFile("subtitles.ass", encoder.encode(assContent));
  onProgress(30);

  // 4. Build FFmpeg command
  const { width, height } = getResolutionDimensions(resolution, aspectRatio);

  const filterParts: string[] = [];

  // Scale to target resolution
  filterParts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
  filterParts.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);

  // Burn subtitles
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

  // 5. Read output
  const outputData = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  // Cleanup FS
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

  // Write input video
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);
  onProgress(18);

  // Write music if provided
  const hasMusic = !!musicUrl;
  if (hasMusic) {
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile("music.mp3", musicData);
  }
  onProgress(22);

  // Write subtitles
  const assContent = generateASSSubtitles(segments, captionStyle);
  const encoder = new TextEncoder();
  await ffmpeg.writeFile("subtitles.ass", encoder.encode(assContent));
  onProgress(25);

  // Build complex filter chain
  const { width, height } = getResolutionDimensions(resolution, aspectRatio);

  const videoFilters: string[] = [];

  // Scale
  videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
  videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);

  // Color grading — parse CSS filter string into FFmpeg eq/hue
  if (colorGrading) {
    const eqParts: string[] = [];
    const brightnessMatch = colorGrading.match(/brightness\(([\d.]+)\)/);
    const contrastMatch = colorGrading.match(/contrast\(([\d.]+)\)/);
    const saturateMatch = colorGrading.match(/saturate\(([\d.]+)\)/);
    const hueMatch = colorGrading.match(/hue-rotate\(([\d.]+)deg\)/);

    if (brightnessMatch) {
      // CSS brightness 1=normal → FFmpeg eq brightness 0=normal, range -1 to 1
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

  // Zoom/pan keyframes
  if (zoomKeyframes && zoomKeyframes.length > 0) {
    // Simple approach: use zoompan with expr based on time
    // For WASM performance, keep it simple — use the first keyframe as a base
    const maxScale = Math.max(...zoomKeyframes.map((k) => k.scale));
    const minScale = Math.min(...zoomKeyframes.map((k) => k.scale));
    const avgScale = (maxScale + minScale) / 2;
    videoFilters.push(
      `zoompan=z='${avgScale.toFixed(2)}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30`
    );
  }

  // Subtitles (always last in video chain)
  videoFilters.push("ass=subtitles.ass");

  // Build args
  const args: string[] = ["-i", "input.mp4"];

  if (hasMusic) {
    args.push("-i", "music.mp3");
  }

  // Video filter
  args.push("-vf", videoFilters.join(","));

  // Audio handling
  if (hasMusic) {
    // Mix original audio with music
    const audioFilters: string[] = [];

    // Build audio filter for mixing
    let audioFilter = `[0:a][1:a]amix=inputs=2:duration=first:weights=1 ${musicVolume}`;

    // Fade in
    if (fadeIn && fadeIn > 0) {
      audioFilter += `[amixed];[amixed]afade=t=in:d=${fadeIn}`;
    }

    // Fade out — we need video duration, approximate from segments
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
    // Don't copy audio when we have a filter
    args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23");
  } else {
    // Audio fades without music
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

  // Read output
  const outputData = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  // Cleanup
  await ffmpeg.deleteFile("input.mp4").catch(() => {});
  await ffmpeg.deleteFile("subtitles.ass").catch(() => {});
  await ffmpeg.deleteFile("output.mp4").catch(() => {});
  if (hasMusic) await ffmpeg.deleteFile("music.mp3").catch(() => {});

  onProgress(100);

  return { url, blob, size: blob.size };
}
