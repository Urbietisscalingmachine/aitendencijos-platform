/* ═══════════════════════════════════════════════════════════
   AI MUSIC SUGGESTION — POST /api/music/suggest
   Analyzes transcript → suggests genre + mood → returns tracks
   Uses OpenAI GPT-4o-mini (primary), Claude (fallback)
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { MusicTrack } from "@/types/cineflow";

// ── CORS headers ─────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

// ── Types ────────────────────────────────────────────────

interface SuggestionResult {
  genre: string;
  mood: string;
  reasoning: string;
  tracks: MusicTrack[];
}

const AI_PROMPT = `Analyze this video transcript and suggest the best background music.

TRANSCRIPT:
{TRANSCRIPT}

Respond in JSON only (no markdown, no extra text):
{
  "genre": "<one of: lo-fi, cinematic, corporate, electronic, acoustic, ambient>",
  "mood": "<one of: happy, sad, dramatic, chill, energetic, inspiring, dark, romantic>",
  "reasoning": "<1-2 sentence explanation>"
}`;

// ── OpenAI GPT-4o-mini call ──────────────────────────────

async function suggestWithOpenAI(
  transcript: string,
  apiKey: string
): Promise<{ genre: string; mood: string; reasoning: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: AI_PROMPT.replace("{TRANSCRIPT}", transcript),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

// ── Anthropic Claude call ────────────────────────────────

async function suggestWithClaude(
  transcript: string,
  apiKey: string
): Promise<{ genre: string; mood: string; reasoning: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: AI_PROMPT.replace("{TRANSCRIPT}", transcript),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

// ── Simple keyword fallback ──────────────────────────────

function simpleAnalysis(text: string): {
  genre: string;
  mood: string;
  reasoning: string;
} {
  const lower = text.toLowerCase();

  const moodKeywords: Record<string, string[]> = {
    happy: ["happy", "joy", "great", "amazing", "wonderful", "excited", "fun", "love"],
    sad: ["sad", "unfortunately", "loss", "miss", "sorry", "pain", "struggle"],
    dramatic: ["dramatic", "incredible", "shocking", "breaking", "urgent", "critical"],
    energetic: ["energy", "fast", "quick", "action", "power", "strong", "intense"],
    inspiring: ["inspire", "dream", "achieve", "goal", "success", "future", "believe"],
    chill: ["relax", "calm", "easy", "gentle", "peaceful", "slow"],
    dark: ["dark", "fear", "danger", "warning", "threat", "horror"],
    romantic: ["love", "heart", "together", "romance", "beautiful"],
  };

  const genreKeywords: Record<string, string[]> = {
    corporate: ["business", "company", "market", "invest", "revenue", "growth", "strategy"],
    cinematic: ["story", "journey", "adventure", "epic", "world", "discover"],
    electronic: ["tech", "digital", "ai", "computer", "software", "code", "data"],
    "lo-fi": ["study", "chill", "vlog", "day", "routine", "morning"],
    acoustic: ["nature", "outdoor", "travel", "walk", "simple", "craft"],
    ambient: ["space", "meditation", "focus", "ambient", "sound"],
  };

  let detectedMood = "chill";
  let maxMoodScore = 0;
  for (const [m, keywords] of Object.entries(moodKeywords)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > maxMoodScore) {
      maxMoodScore = score;
      detectedMood = m;
    }
  }

  let detectedGenre = "ambient";
  let maxGenreScore = 0;
  for (const [g, keywords] of Object.entries(genreKeywords)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > maxGenreScore) {
      maxGenreScore = score;
      detectedGenre = g;
    }
  }

  return {
    genre: detectedGenre,
    mood: detectedMood,
    reasoning: `Keyword analysis detected ${detectedGenre} genre with ${detectedMood} mood based on transcript content.`,
  };
}

// ── POST handler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing 'transcript' field (string)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Truncate to save tokens
    const truncated = transcript.slice(0, 3000);

    let genre = "ambient";
    let mood = "chill";
    let reasoning = "Default suggestion (no API key configured)";

    // Try OpenAI GPT-4o-mini first, then Claude, then keyword fallback
    const openaiKey = process.env.OPENAI_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY;

    if (openaiKey) {
      try {
        const result = await suggestWithOpenAI(truncated, openaiKey);
        genre = result.genre || genre;
        mood = result.mood || mood;
        reasoning = result.reasoning || reasoning;
      } catch (e) {
        console.error("[Music Suggest] OpenAI failed:", e);
        if (claudeKey) {
          try {
            const result = await suggestWithClaude(truncated, claudeKey);
            genre = result.genre || genre;
            mood = result.mood || mood;
            reasoning = result.reasoning || reasoning;
          } catch (e2) {
            console.error("[Music Suggest] Claude also failed:", e2);
            const result = simpleAnalysis(truncated);
            genre = result.genre;
            mood = result.mood;
            reasoning = result.reasoning;
          }
        } else {
          const result = simpleAnalysis(truncated);
          genre = result.genre;
          mood = result.mood;
          reasoning = result.reasoning;
        }
      }
    } else if (claudeKey) {
      try {
        const result = await suggestWithClaude(truncated, claudeKey);
        genre = result.genre || genre;
        mood = result.mood || mood;
        reasoning = result.reasoning || reasoning;
      } catch (e) {
        console.error("[Music Suggest] Claude failed:", e);
        const result = simpleAnalysis(truncated);
        genre = result.genre;
        mood = result.mood;
        reasoning = result.reasoning;
      }
    } else {
      const result = simpleAnalysis(truncated);
      genre = result.genre;
      mood = result.mood;
      reasoning = result.reasoning;
    }

    // Fetch matching tracks from the music library
    const baseUrl = request.nextUrl.origin;
    let tracks: MusicTrack[] = [];

    try {
      const musicRes = await fetch(
        `${baseUrl}/api/music?genre=${encodeURIComponent(genre)}&mood=${encodeURIComponent(mood)}&page=1`,
        { cache: "no-store" }
      );
      if (musicRes.ok) {
        const musicData = await musicRes.json();
        tracks = (musicData.tracks || []).slice(0, 5);
      }
    } catch (e) {
      console.error("[Music Suggest] Track fetch failed:", e);
    }

    // If no exact match, try genre-only
    if (tracks.length === 0) {
      try {
        const musicRes = await fetch(
          `${baseUrl}/api/music?genre=${encodeURIComponent(genre)}&page=1`,
          { cache: "no-store" }
        );
        if (musicRes.ok) {
          const musicData = await musicRes.json();
          tracks = (musicData.tracks || []).slice(0, 5);
        }
      } catch (e) {
        console.error("[Music Suggest] Genre-only fetch failed:", e);
      }
    }

    const result: SuggestionResult = {
      genre,
      mood,
      reasoning,
      tracks,
    };

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[Music Suggest] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate music suggestion" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
