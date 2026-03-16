import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { feature, transcript } = body;

    if (feature === "thumbnail") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a YouTube thumbnail text generator. Given a video transcript, generate 5 compelling, clickbait-style thumbnail text suggestions. Each should have:
- title: short, punchy text (max 6 words, uppercase)
- subtitle: supporting text (max 4 words)
- emotion: one of "shocked", "happy", "curious", "serious", "excited"

Return ONLY valid JSON array. Example:
[{"title":"ŠITAS PAKEITĖ VISKĄ","subtitle":"Niekada nebūčiau tikėjęs","emotion":"shocked"}]

Prioritize Lithuanian language if transcript is in Lithuanian, otherwise use English.`,
            },
            {
              role: "user",
              content: `Generate 5 thumbnail text suggestions for this video transcript:\n\n${transcript.substring(0, 2000)}`,
            },
          ],
          temperature: 0.9,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";

      // Parse JSON from response
      let suggestions = [];
      try {
        // Extract JSON array from possible markdown code blocks
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error("[smart-features] Failed to parse thumbnail suggestions:", content);
      }

      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
  } catch (err) {
    console.error("[smart-features] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
