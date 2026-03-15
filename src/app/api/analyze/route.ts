/* ═══════════════════════════════════════════════════════════
   /api/analyze — AI Video Transcript Analysis
   POST { transcript, language } → structured editing plan
   Uses OpenAI GPT-4o (primary) or Anthropic Claude (fallback)
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── CORS headers ─────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

// ── Response types ───────────────────────────────────────

interface BrollSuggestion {
  timestamp: number;
  duration: number;
  keyword: string;
  cinematicPrompt: string;
  pexelsQuery: string;
}

interface ZoomMoment {
  timestamp: number;
  word: string;
  type: "quick-emphasis" | "slow-zoom" | "zoom-out" | "zoom-pulse";
}

interface SilenceSegment {
  start: number;
  end: number;
}

interface KeyMoment {
  timestamp: number;
  text: string;
  importance: "high" | "medium" | "low";
}

interface AnalysisResult {
  brollSuggestions: BrollSuggestion[];
  zoomMoments: ZoomMoment[];
  silenceSegments: SilenceSegment[];
  suggestedMusic: { genre: string; mood: string };
  hookTimestamp: number;
  keyMoments: KeyMoment[];
}

// ── System prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `Tu esi profesionalus video redaktorius su 15+ metų patirtimi montuojant YouTube, TikTok ir reklaminius video. Tavo užduotis — analizuoti video transkripciją ir pateikti detalų montavimo planą.

Analizuok pateiktą transkripciją ir grąžink JSON su šiais laukais:

1. **brollSuggestions** — vietos, kur reikia B-roll vaizdo įrašų:
   - "timestamp": sekundė transkripte kur pradėti B-roll
   - "duration": kiek sekundžių rodyti B-roll (2-5 sek)
   - "keyword": pagrindinis žodis/tema toje vietoje
   - "cinematicPrompt": detalus prompt AI video generavimui (aprašyk sceną, apšvietimą, kampą, judėjimą, nuotaiką — anglų kalba)
   - "pexelsQuery": paieškos frazė stock video (anglų kalba, 2-4 žodžiai)
   
   Siūlyk B-roll kas 15-30 sekundžių arba kai kalbama apie konkretų dalyką/konceptą.

2. **zoomMoments** — vietos, kur pritaikyti zoom efektą:
   - "timestamp": sekundė
   - "word": žodis ant kurio zoom'inti
   - "type": "quick-emphasis" (greitas 1.2x zoom stipriems žodžiams), "slow-zoom" (lėtas artėjimas svarbiai minčiai), "zoom-out" (atitolinti po kulminacijos), "zoom-pulse" (pulsavimas energingiems momentams)
   
   Zoom naudok ant emocingų, svarbių, stebinančių žodžių. Nevartok per dažnai — max 1 kas 10-15 sek.

3. **silenceSegments** — tylos momentai (pauzės tarp sakinių >1.5 sek):
   - "start": pradžia sekundėmis
   - "end": pabaiga sekundėmis

4. **suggestedMusic** — rekomenduojama foninė muzika:
   - "genre": vienas iš: "lo-fi", "cinematic", "corporate", "electronic", "acoustic", "hip-hop", "ambient"
   - "mood": vienas iš: "happy", "sad", "dramatic", "chill", "energetic", "inspiring", "dark"

5. **hookTimestamp** — sekundė kur prasideda stipriausias hook (dažnai 0, bet gali būti kita vieta jei video pradžia lėta)

6. **keyMoments** — svarbiausi momentai transkripte:
   - "timestamp": sekundė
   - "text": trumpas aprašymas kas vyksta
   - "importance": "high", "medium", arba "low"

SVARBU:
- Grąžink TIKTAI validų JSON (be markdown, be komentarų, be papildomo teksto)
- Timestamps turi atitikti transkripciją
- CinematicPrompt rašyk angliškai, detaliai, su konkrečiais vizualiniais elementais
- Būk kūrybingas su B-roll pasiūlymais — ne generic stock footage, o tikrai vizualiai įdomūs kadrai`;

// ── OpenAI call ──────────────────────────────────────────

async function analyzeWithOpenAI(
  transcript: string,
  language: string,
  apiKey: string
): Promise<AnalysisResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Kalba: ${language}\n\nTRANSKRIPCIJA:\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  return parseAnalysisJSON(content);
}

// ── Anthropic Claude call ────────────────────────────────

async function analyzeWithClaude(
  transcript: string,
  language: string,
  apiKey: string
): Promise<AnalysisResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Kalba: ${language}\n\nTRANSKRIPCIJA:\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content: string = data.content?.[0]?.text || "";
  return parseAnalysisJSON(content);
}

// ── Parse JSON from LLM output ───────────────────────────

function parseAnalysisJSON(raw: string): AnalysisResult {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/```json?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  // Validate & provide defaults
  return {
    brollSuggestions: Array.isArray(parsed.brollSuggestions)
      ? parsed.brollSuggestions.map((s: Record<string, unknown>) => ({
          timestamp: Number(s.timestamp) || 0,
          duration: Number(s.duration) || 3,
          keyword: String(s.keyword || ""),
          cinematicPrompt: String(s.cinematicPrompt || ""),
          pexelsQuery: String(s.pexelsQuery || ""),
        }))
      : [],
    zoomMoments: Array.isArray(parsed.zoomMoments)
      ? parsed.zoomMoments.map((z: Record<string, unknown>) => ({
          timestamp: Number(z.timestamp) || 0,
          word: String(z.word || ""),
          type: (z.type as ZoomMoment["type"]) || "quick-emphasis",
        }))
      : [],
    silenceSegments: Array.isArray(parsed.silenceSegments)
      ? parsed.silenceSegments.map((s: Record<string, unknown>) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
        }))
      : [],
    suggestedMusic: {
      genre: String(parsed.suggestedMusic?.genre || "ambient"),
      mood: String(parsed.suggestedMusic?.mood || "chill"),
    },
    hookTimestamp: Number(parsed.hookTimestamp) || 0,
    keyMoments: Array.isArray(parsed.keyMoments)
      ? parsed.keyMoments.map((k: Record<string, unknown>) => ({
          timestamp: Number(k.timestamp) || 0,
          text: String(k.text || ""),
          importance:
            (k.importance as KeyMoment["importance"]) || "medium",
        }))
      : [],
  };
}

// ── POST handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, language = "lt" } = body as {
      transcript: string;
      language?: string;
    };

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing required field: transcript (string)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (transcript.trim().length < 10) {
      return NextResponse.json(
        { error: "Transcript too short for analysis" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Truncate very long transcripts to keep token usage reasonable
    const maxChars = 15_000;
    const truncatedTranscript =
      transcript.length > maxChars
        ? transcript.slice(0, maxChars) + "\n\n[...transkripcija sutrumpinta]"
        : transcript;

    // Try OpenAI first, fall back to Claude
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    let result: AnalysisResult;

    if (openaiKey) {
      try {
        result = await analyzeWithOpenAI(
          truncatedTranscript,
          language,
          openaiKey
        );
      } catch (openaiErr) {
        console.error("[Analyze] OpenAI failed, trying Claude:", openaiErr);
        if (anthropicKey) {
          result = await analyzeWithClaude(
            truncatedTranscript,
            language,
            anthropicKey
          );
        } else {
          throw openaiErr;
        }
      }
    } else if (anthropicKey) {
      result = await analyzeWithClaude(
        truncatedTranscript,
        language,
        anthropicKey
      );
    } else {
      return NextResponse.json(
        {
          error:
            "No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.",
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[Analyze] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Analysis failed", detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
