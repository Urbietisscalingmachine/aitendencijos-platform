/**
 * Extract audio from video file using AudioContext decodeAudioData.
 * Returns 16kHz mono WAV blob.
 * 
 * Falls back to null if browser doesn't support decoding video audio
 * (e.g. Safari iOS with video/mp4).
 */

const MAX_OUTPUT_SIZE = 4 * 1024 * 1024; // 4MB

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<Blob | null> {
  // Skip if file already small enough for direct upload
  if (videoFile.size <= MAX_OUTPUT_SIZE) {
    return null;
  }

  try {
    onProgress?.(10);
    const arrayBuffer = await videoFile.arrayBuffer();
    onProgress?.(30);

    const sampleRate = 16000;
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      sampleRate,
    });

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detached buffer
    } catch {
      console.warn("[audio-extract] decodeAudioData failed — browser may not support video decoding");
      audioCtx.close();
      return null;
    }
    onProgress?.(60);

    // Mono mixdown
    let monoData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      monoData = audioBuffer.getChannelData(0);
    } else {
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      monoData = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        monoData[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    // Downsample if WAV would exceed limit
    let finalData = monoData;
    let finalRate = audioBuffer.sampleRate;
    const estimatedSize = monoData.length * 2 + 44;

    if (estimatedSize > MAX_OUTPUT_SIZE) {
      const factor = Math.ceil(estimatedSize / MAX_OUTPUT_SIZE);
      const newLen = Math.floor(monoData.length / factor);
      finalData = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        finalData[i] = monoData[i * factor];
      }
      finalRate = Math.floor(finalRate / factor);
    }

    onProgress?.(80);
    const wav = encodeWAV(finalData, finalRate);
    audioCtx.close();
    onProgress?.(100);

    console.log(`[audio-extract] ${(wav.size / 1024).toFixed(0)}KB WAV from ${(videoFile.size / 1048576).toFixed(1)}MB video (${audioBuffer.duration.toFixed(0)}s @ ${finalRate}Hz)`);
    return wav;
  } catch (err) {
    console.error("[audio-extract] Fatal:", err);
    return null;
  }
}

/**
 * Transcribe directly via OpenAI Whisper API from the client.
 * Bypasses Vercel's 4.5MB body size limit entirely.
 * Used as fallback when audio extraction fails (Safari iOS).
 */
export async function transcribeClientSide(
  file: File,
  apiKey: string,
  language: string = "lt",
  onProgress?: (pct: number) => void
): Promise<{ segments: TranscriptSegment[]; language: string; duration: number } | null> {
  try {
    onProgress?.(10);

    const fd = new FormData();
    fd.append("file", file, file.name || "video.mp4");
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    fd.append("timestamp_granularities[]", "word");
    fd.append("timestamp_granularities[]", "segment");
    if (language) fd.append("language", language);

    onProgress?.(20);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    onProgress?.(80);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[transcribe-client] Whisper API error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    onProgress?.(90);

    const allWords: WordTimestamp[] = (data.words ?? []).map((w: { word: string; start: number; end: number }) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    const segments: TranscriptSegment[] = (data.segments ?? []).map(
      (seg: { text: string; start: number; end: number }, idx: number) => {
        const segWords = allWords.filter((w) => w.start >= seg.start && w.end <= seg.end + 0.05);
        return {
          id: `seg-${idx}`,
          text: (seg.text ?? "").trim(),
          start: seg.start,
          end: seg.end,
          words: segWords,
        };
      }
    );

    if (segments.length === 0 && data.text) {
      segments.push({
        id: "seg-0",
        text: data.text.trim(),
        start: 0,
        end: data.duration ?? 0,
        words: allWords,
      });
    }

    onProgress?.(100);
    return {
      segments,
      language: data.language ?? language,
      duration: data.duration ?? 0,
    };
  } catch (err) {
    console.error("[transcribe-client] Fatal:", err);
    return null;
  }
}

// Types (matching cineflow.ts)
interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const bps = 16;
  const bytesPerSample = bps / 8;
  const dataLen = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);

  writeStr(v, 0, "RIFF");
  v.setUint32(4, 36 + dataLen, true);
  writeStr(v, 8, "WAVE");
  writeStr(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true);
  v.setUint16(32, bytesPerSample, true);
  v.setUint16(34, bps, true);
  writeStr(v, 36, "data");
  v.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buf], { type: "audio/wav" });
}

function writeStr(v: DataView, off: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
}
