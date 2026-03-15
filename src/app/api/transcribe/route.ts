/* ═══════════════════════════════════════════════════════════
   /api/transcribe — Whisper word-level transcription
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { TranscriptSegment, WordTimestamp } from "@/types/cineflow";

export const runtime = "nodejs";
export const maxDuration = 120; // Whisper can be slow on long files

// OPTIONS: return a temporary token for client-side Whisper (when files are too large for Vercel)
export async function OPTIONS() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }
  // Return the key for client-side use (this is your own app, not public)
  return NextResponse.json({ key: apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a file field in FormData." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/wav",
      "audio/webm",
      "audio/ogg",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];
    if (file.type && !allowedTypes.some((t) => file.type.startsWith(t.split("/")[0]))) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Optional language hint
    const language = (formData.get("language") as string) || undefined;

    // Build Whisper request
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.mp3");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "word");
    whisperForm.append("timestamp_granularities[]", "segment");
    if (language) whisperForm.append("language", language);

    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      }
    );

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text();
      console.error("Whisper API error:", whisperRes.status, errBody);
      return NextResponse.json(
        { error: "Whisper API error", detail: errBody },
        { status: whisperRes.status }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whisperData: any = await whisperRes.json();

    // ── Map Whisper segments → TranscriptSegment[] ─────────
    const allWords: WordTimestamp[] = (whisperData.words ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSegments: any[] = whisperData.segments ?? [];

    const segments: TranscriptSegment[] = rawSegments.map((seg, idx) => {
      // Assign words that fall within this segment's time range
      const segWords = allWords.filter(
        (w) => w.start >= seg.start && w.end <= seg.end + 0.05
      );

      return {
        id: `seg-${idx}`,
        text: (seg.text ?? "").trim(),
        start: seg.start,
        end: seg.end,
        words: segWords,
      };
    });

    // Fallback: if Whisper returned no segments, create one from full text
    if (segments.length === 0 && whisperData.text) {
      segments.push({
        id: "seg-0",
        text: whisperData.text.trim(),
        start: 0,
        end: whisperData.duration ?? 0,
        words: allWords,
      });
    }

    return NextResponse.json({
      segments,
      language: whisperData.language ?? null,
      duration: whisperData.duration ?? null,
    });
  } catch (err) {
    console.error("Transcribe route error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
