/**
 * Compress video for Whisper API (max 25MB).
 * 
 * Strategy: Use MediaRecorder to re-encode just the audio track
 * at low bitrate. This works on all modern browsers including Safari iOS.
 * 
 * If the file is already ≤25MB, returns null (use original).
 */

const WHISPER_MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function compressForWhisper(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<File | null> {
  // Skip if already small enough
  if (videoFile.size <= WHISPER_MAX_SIZE) {
    onProgress?.(100);
    return null;
  }

  onProgress?.(5);

  return new Promise<File | null>((resolve) => {
    try {
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true; // Required for autoplay on mobile
      video.preload = "auto";

      const objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;

      const cleanup = () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(objectUrl);
      };

      // Safety timeout
      const timeout = setTimeout(() => {
        console.warn("[compress] Timeout");
        cleanup();
        resolve(null);
      }, 180_000);

      video.onerror = () => {
        console.error("[compress] Video error:", video.error);
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      };

      video.onloadedmetadata = () => {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          clearTimeout(timeout);
          cleanup();
          resolve(null);
          return;
        }

        onProgress?.(10);

        // Create AudioContext and connect video as source
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        // Also connect to speakers (required for some browsers)
        // but video is muted so no sound
        source.connect(audioCtx.destination);

        // Get audio stream
        const audioStream = dest.stream;

        // Find supported mime type
        const mimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
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
          console.warn("[compress] No supported audio MIME type");
          clearTimeout(timeout);
          cleanup();
          audioCtx.close();
          resolve(null);
          return;
        }

        // Target bitrate: aim for output < 25MB
        // 25MB / duration_seconds * 8 = max bits/sec
        const maxBps = Math.floor((WHISPER_MAX_SIZE * 8) / duration);
        const bitrate = Math.max(16000, Math.min(128000, maxBps));

        const recorder = new MediaRecorder(audioStream, {
          mimeType,
          audioBitsPerSecond: bitrate,
        });

        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          clearTimeout(timeout);
          audioCtx.close();

          const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";
          const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
          cleanup();

          if (blob.size === 0) {
            console.warn("[compress] Empty audio blob");
            resolve(null);
            return;
          }

          const audioFile = new File([blob], `audio.${ext}`, { type: mimeType.split(";")[0] });
          console.log(
            `[compress] ${(audioFile.size / 1024).toFixed(0)}KB audio from ${(videoFile.size / 1048576).toFixed(1)}MB video (${duration.toFixed(0)}s @ ${bitrate}bps)`
          );
          onProgress?.(100);
          resolve(audioFile);
        };

        recorder.onerror = () => {
          console.error("[compress] MediaRecorder error");
          clearTimeout(timeout);
          cleanup();
          audioCtx.close();
          resolve(null);
        };

        // Track progress
        video.ontimeupdate = () => {
          if (isFinite(duration) && duration > 0) {
            const pct = Math.min(95, 10 + (video.currentTime / duration) * 85);
            onProgress?.(pct);
          }
        };

        video.onended = () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        };

        // Start recording then play
        recorder.start(500);
        
        // Play at normal speed (1x) — audio must play in real-time
        // for MediaRecorder to capture it properly
        video.playbackRate = 1;
        video.play().catch((err) => {
          console.error("[compress] Play failed:", err);
          clearTimeout(timeout);
          if (recorder.state === "recording") recorder.stop();
          cleanup();
          audioCtx.close();
          resolve(null);
        });
      };
    } catch (err) {
      console.error("[compress] Fatal:", err);
      resolve(null);
    }
  });
}
