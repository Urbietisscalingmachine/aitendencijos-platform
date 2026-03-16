/**
 * Extract and compress audio from ANY size video using FFmpeg WASM.
 * Works in all browsers, no server needed.
 * Output: small MP3 file suitable for Whisper API (<25MB).
 * 
 * 64kbps MP3 mono ≈ 480KB/min → 10 min video = ~5MB
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  
  if (ffmpegLoading) {
    // Wait for ongoing load
    while (ffmpegLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (ffmpegInstance?.loaded) return ffmpegInstance;
  }

  ffmpegLoading = true;
  try {
    const ffmpeg = new FFmpeg();
    
    // Load FFmpeg WASM with CORS-friendly URLs
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
    });
    
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } finally {
    ffmpegLoading = false;
  }
}

export async function extractAudioForWhisper(
  videoFile: File,
  onProgress?: (message: string, pct: number) => void
): Promise<File | null> {
  // Skip if already small enough for Whisper
  if (videoFile.size <= 25 * 1024 * 1024) {
    return null; // Use original file
  }

  try {
    onProgress?.("Ruošiamas FFmpeg...", 5);
    const ffmpeg = await getFFmpeg();

    onProgress?.("Įkeliamas video...", 15);
    
    // Write input file to FFmpeg virtual filesystem
    const inputName = "input" + getExtension(videoFile.name);
    const inputData = await fetchFile(videoFile);
    await ffmpeg.writeFile(inputName, inputData);

    onProgress?.("Ištraukiamas audio...", 30);

    // Set up progress tracking
    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.min(90, 30 + progress * 60);
      onProgress?.(`Ištraukiamas audio... ${Math.round(pct)}%`, pct);
    });

    // Extract audio only, compress to MP3 mono 64kbps
    // -vn = no video, -ac 1 = mono, -ar 16000 = 16kHz (Whisper optimal)
    // -b:a 64k = 64kbps (good quality for speech, ~480KB/min)
    await ffmpeg.exec([
      "-i", inputName,
      "-vn",           // No video
      "-ac", "1",      // Mono
      "-ar", "16000",  // 16kHz sample rate
      "-b:a", "64k",   // 64kbps bitrate
      "-f", "mp3",     // MP3 format
      "output.mp3"
    ]);

    onProgress?.("Nuskaitomas rezultatas...", 92);

    // Read output
    const outputData = await ffmpeg.readFile("output.mp3");
    
    // Cleanup virtual filesystem
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile("output.mp3");
    } catch { /* ignore cleanup errors */ }

    const audioBlob = new Blob([outputData], { type: "audio/mpeg" });
    const audioFile = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    onProgress?.("Audio paruoštas!", 100);

    console.log(
      `[ffmpeg-extract] ${(audioFile.size / 1024).toFixed(0)}KB MP3 from ${(videoFile.size / 1048576).toFixed(1)}MB video`
    );

    // Verify it's under 25MB
    if (audioFile.size > 25 * 1024 * 1024) {
      console.warn(`[ffmpeg-extract] Audio still ${(audioFile.size/1048576).toFixed(1)}MB — trying lower bitrate`);
      
      // Re-encode at even lower bitrate
      const inputData2 = await fetchFile(videoFile);
      await ffmpeg.writeFile(inputName, inputData2);
      await ffmpeg.exec([
        "-i", inputName,
        "-vn", "-ac", "1", "-ar", "16000",
        "-b:a", "32k",  // 32kbps
        "-f", "mp3",
        "output2.mp3"
      ]);
      const outputData2 = await ffmpeg.readFile("output2.mp3");
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile("output2.mp3");
      } catch { /* ignore */ }
      
      const audioFile2 = new File(
        [new Blob([outputData2], { type: "audio/mpeg" })],
        "audio.mp3",
        { type: "audio/mpeg" }
      );
      console.log(`[ffmpeg-extract] Retry: ${(audioFile2.size / 1024).toFixed(0)}KB`);
      return audioFile2;
    }

    return audioFile;
  } catch (err) {
    console.error("[ffmpeg-extract] Failed:", err);
    return null;
  }
}

function getExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext)) {
    return `.${ext}`;
  }
  return ".mp4";
}
