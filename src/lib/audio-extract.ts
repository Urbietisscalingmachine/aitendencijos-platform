/**
 * Extract audio from video file in the browser using Web Audio API + MediaRecorder.
 * Returns a small WebM/Opus blob suitable for Whisper API (<4MB).
 *
 * Strategy:
 * 1. Create an offscreen <video> element with accelerated playback (16x)
 * 2. Capture the media stream via captureStream()
 * 3. Record only the audio track with MediaRecorder (audio/webm;codecs=opus)
 * 4. Use low bitrate (32kbps mono) to keep output < 4MB even for 10+ min videos
 *
 * Fallback: if extraction fails, returns null so caller can send original file.
 */

const MAX_OUTPUT_SIZE = 4 * 1024 * 1024; // 4MB hard limit

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<Blob | null> {
  // Skip extraction if file is already small enough
  if (videoFile.size <= MAX_OUTPUT_SIZE) {
    return null; // caller will use original
  }

  return new Promise<Blob | null>((resolve) => {
    try {
      const video = document.createElement("video");
      video.muted = false; // must NOT be muted — we need audio stream
      video.playsInline = true;
      video.preload = "auto";

      const objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;

      const cleanup = () => {
        video.pause();
        video.src = "";
        video.load();
        URL.revokeObjectURL(objectUrl);
      };

      // Timeout safety: if extraction takes > 120s, bail out
      const timeout = setTimeout(() => {
        console.warn("[audio-extract] Timeout — aborting extraction");
        cleanup();
        resolve(null);
      }, 120_000);

      video.addEventListener("error", () => {
        console.error("[audio-extract] Video element error:", video.error);
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      });

      video.addEventListener("loadedmetadata", () => {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          console.error("[audio-extract] Invalid video duration");
          clearTimeout(timeout);
          cleanup();
          resolve(null);
          return;
        }

        // captureStream() is required — check support
        if (typeof (video as any).captureStream !== "function") {
          console.warn("[audio-extract] captureStream not supported");
          clearTimeout(timeout);
          cleanup();
          resolve(null);
          return;
        }

        // Determine bitrate: aim for output < 4MB
        // Budget: 4MB = 4 * 1024 * 1024 * 8 bits = 33,554,432 bits
        // Available per second: budget / duration
        const budgetBitsPerSec = Math.floor((MAX_OUTPUT_SIZE * 8) / duration);
        // Clamp between 16kbps and 64kbps (opus handles low rates well)
        const targetBitrate = Math.max(16_000, Math.min(64_000, budgetBitsPerSec));

        try {
          // Capture stream from video
          const stream: MediaStream = (video as any).captureStream();
          const audioTracks = stream.getAudioTracks();

          if (audioTracks.length === 0) {
            console.warn("[audio-extract] No audio tracks in video");
            clearTimeout(timeout);
            cleanup();
            resolve(null);
            return;
          }

          // Create audio-only stream
          const audioStream = new MediaStream(audioTracks);

          // Determine supported MIME type
          const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
          ];
          let mimeType = "";
          for (const mt of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mt)) {
              mimeType = mt;
              break;
            }
          }
          if (!mimeType) {
            console.warn("[audio-extract] No supported audio MIME type found");
            clearTimeout(timeout);
            cleanup();
            resolve(null);
            return;
          }

          const recorder = new MediaRecorder(audioStream, {
            mimeType,
            audioBitsPerSecond: targetBitrate,
          });

          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorder.onstop = () => {
            clearTimeout(timeout);
            const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
            cleanup();

            if (blob.size === 0) {
              console.warn("[audio-extract] Recorded blob is empty");
              resolve(null);
              return;
            }

            if (blob.size > MAX_OUTPUT_SIZE) {
              console.warn(
                `[audio-extract] Output ${(blob.size / 1024 / 1024).toFixed(1)}MB exceeds limit`
              );
              // Still return it — better than sending the 15MB video
            }

            console.log(
              `[audio-extract] Done: ${(blob.size / 1024).toFixed(0)}KB from ${(videoFile.size / 1024 / 1024).toFixed(1)}MB video (${duration.toFixed(0)}s)`
            );
            resolve(blob);
          };

          recorder.onerror = (e) => {
            console.error("[audio-extract] MediaRecorder error:", e);
            clearTimeout(timeout);
            cleanup();
            resolve(null);
          };

          // Progress tracking via timeupdate
          video.addEventListener("timeupdate", () => {
            if (onProgress && isFinite(duration) && duration > 0) {
              const pct = Math.min(100, (video.currentTime / duration) * 100);
              onProgress(pct);
            }
          });

          // When video ends — stop recording
          video.addEventListener("ended", () => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          });

          // Start recording, then play video at maximum speed
          recorder.start(1000); // collect chunks every second

          // Set playback rate BEFORE play
          // Most browsers support up to 16x, some only 4x
          // Use highest supported rate for fastest extraction
          video.playbackRate = 16;
          video.play().then(() => {
            // Verify playback rate was accepted
            if (video.playbackRate < 16) {
              // Browser capped it — try stepping down
              video.playbackRate = Math.min(video.playbackRate, 8);
            }
          }).catch((playErr) => {
            console.error("[audio-extract] Play failed:", playErr);
            // Try with lower rate
            video.playbackRate = 4;
            video.play().catch(() => {
              // Give up — user interaction required
              clearTimeout(timeout);
              if (recorder.state === "recording") {
                recorder.stop();
              }
              cleanup();
              resolve(null);
            });
          });
        } catch (err) {
          console.error("[audio-extract] Setup error:", err);
          clearTimeout(timeout);
          cleanup();
          resolve(null);
        }
      });
    } catch (err) {
      console.error("[audio-extract] Fatal error:", err);
      resolve(null);
    }
  });
}
