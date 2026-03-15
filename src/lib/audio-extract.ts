/**
 * Extract audio from video file using AudioContext decodeAudioData.
 * Converts to 16kHz mono WAV — small enough for Whisper API and under Vercel 4.5MB limit.
 * 
 * 16kHz mono 16-bit WAV ≈ 1.9MB per minute.
 * For videos > 2 min, downsample further or truncate.
 */

const MAX_OUTPUT_SIZE = 4 * 1024 * 1024; // 4MB

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<Blob | null> {
  // Skip if file already small
  if (videoFile.size <= MAX_OUTPUT_SIZE) {
    return null;
  }

  try {
    onProgress?.(10);

    // Read file as ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    onProgress?.(30);

    // Decode audio using AudioContext
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000, // Whisper optimal sample rate
    });

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.error("[audio-extract] decodeAudioData failed:", decodeErr);
      audioCtx.close();
      return null;
    }
    onProgress?.(60);

    // Get mono channel data (mix down if stereo)
    let monoData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      monoData = audioBuffer.getChannelData(0);
    } else {
      // Mix channels to mono
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      monoData = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        monoData[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    // Check if WAV would be too big (16-bit = 2 bytes per sample)
    const wavDataSize = monoData.length * 2;
    const estimatedWavSize = wavDataSize + 44; // WAV header

    // If too big, downsample further (8kHz)
    let finalData = monoData;
    let sampleRate = audioBuffer.sampleRate;

    if (estimatedWavSize > MAX_OUTPUT_SIZE) {
      // Downsample by factor of 2 (8kHz)
      const factor = Math.ceil(estimatedWavSize / MAX_OUTPUT_SIZE);
      const newLength = Math.floor(monoData.length / factor);
      finalData = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        finalData[i] = monoData[i * factor];
      }
      sampleRate = Math.floor(sampleRate / factor);
    }

    onProgress?.(80);

    // Convert to 16-bit PCM WAV
    const wavBlob = encodeWAV(finalData, sampleRate);

    audioCtx.close();
    onProgress?.(100);

    console.log(
      `[audio-extract] Done: ${(wavBlob.size / 1024).toFixed(0)}KB WAV from ${(videoFile.size / 1024 / 1024).toFixed(1)}MB video (${audioBuffer.duration.toFixed(0)}s @ ${sampleRate}Hz)`
    );

    return wavBlob;
  } catch (err) {
    console.error("[audio-extract] Fatal error:", err);
    return null;
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // PCM data
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
