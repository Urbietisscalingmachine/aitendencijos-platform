import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callGPT(system: string, user: string, model = "gpt-4o"): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

function extractJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/) || raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse JSON from GPT response");
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
    }

    const body = await req.json();
    const { feature, transcript, targetLang, duration, subtitles } = body;
    const t = (transcript || "").substring(0, 3000);

    switch (feature) {
      // ═══ HOOKS ═══
      case "hooks": {
        const raw = await callGPT(
          `You are a viral video expert. Generate 3 different hooks for a video. Return JSON: { "hooks": [{ "type": "question"|"bold"|"curiosity", "text": "hook text", "cutPoint": seconds_number, "explanation": "why this works" }] }. If transcript is Lithuanian, write hooks in Lithuanian.`,
          `Transcript:\n${t}\n\nGenerate 3 hooks (question, bold statement, curiosity gap).`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ CHAPTERS ═══
      case "chapters": {
        const raw = await callGPT(
          `You are a video editor. Break the transcript into logical chapters. Return JSON: { "chapters": [{ "title": "chapter name", "timestamp": seconds_number, "endTimestamp": seconds_number, "summary": "brief description" }] }. Use the same language as transcript.`,
          `Transcript:\n${t}\n\nCreate logical chapters.`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ VIRALITY SCORE ═══
      case "virality": {
        const raw = await callGPT(
          `You are a social media strategist. Analyze the video transcript and rate its viral potential. Return JSON: { "score": 1-100, "stars": 1-5, "breakdown": { "hookStrength": { "score": N, "max": 20, "status": "good"|"warning"|"bad", "note": "..." }, "pacing": { "score": N, "max": 20, "status": "...", "note": "..." }, "emotionalPeaks": { "score": N, "max": 20, "status": "...", "note": "..." }, "cta": { "score": N, "max": 20, "status": "...", "note": "..." }, "retention": { "score": N, "max": 20, "status": "...", "note": "..." } }, "tips": ["actionable tip 1", "tip 2", "tip 3"] }. Use transcript language.`,
          `Transcript:\n${t}\n\nAnalyze virality potential.`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ TRANSLATE ═══
      case "translate": {
        const lang = targetLang || "en";
        const subs = subtitles || [];
        const textsToTranslate = subs.length > 0
          ? subs.map((s: { text: string }, i: number) => `${i}: ${s.text}`).join("\n")
          : t;

        const raw = await callGPT(
          `You are a professional translator. Translate the given text/subtitles to ${lang}. Return JSON: { "translations": [{ "index": 0, "original": "original text", "translated": "translated text" }] }. Keep the same order and count.`,
          `Translate to ${lang}:\n${textsToTranslate}`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ HIGHLIGHT REEL ═══
      case "highlight": {
        const dur = duration || 30;
        const raw = await callGPT(
          `You are a video editor. Select the best moments from the transcript to create a ${dur}s highlight reel. Return JSON: { "clips": [{ "start": seconds, "end": seconds, "importance": "high"|"medium", "reason": "why this moment" }], "totalDuration": seconds }. Pick the most engaging, emotional, or informative moments. Maximum total duration: ${dur} seconds.`,
          `Transcript:\n${t}\n\nCreate a ${dur}s highlight reel.`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ SEO ═══
      case "seo": {
        const raw = await callGPT(
          `You are an SEO expert for social media videos. Generate optimized metadata. Return JSON: { "title": "main title", "titleAlternatives": ["alt1", "alt2"], "description": "full description 200-300 chars", "hashtags": ["#tag1", "#tag2", ...], "tags": ["tag1", "tag2", ...] }. Use transcript language. Make it clickworthy.`,
          `Transcript:\n${t}\n\nGenerate SEO-optimized metadata.`
        );
        return NextResponse.json(extractJSON(raw));
      }

      // ═══ THUMBNAIL TEXT ═══
      case "thumbnail": {
        const raw = await callGPT(
          `You are a YouTube thumbnail text generator. Generate 5 compelling, clickbait-style thumbnail text suggestions. Return JSON: { "suggestions": [{ "title": "SHORT PUNCHY TEXT (max 6 words, uppercase)", "subtitle": "supporting text (max 4 words)", "emotion": "shocked"|"happy"|"curious"|"serious"|"excited" }] }. Use transcript language if Lithuanian.`,
          `Transcript:\n${t}\n\nGenerate 5 thumbnail text suggestions.`,
          "gpt-4o-mini"
        );
        const parsed = extractJSON(raw) as { suggestions?: unknown[] };
        return NextResponse.json({ suggestions: parsed.suggestions || [] });
      }

      default:
        return NextResponse.json({ error: `Unknown feature: ${feature}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[smart-features] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
