/* ═══════════════════════════════════════════════════════════
   /api/style-clone — GPT-4o Vision caption style analysis
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { CaptionStyle } from "@/types/cineflow";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a caption style analyzer. Given a screenshot of video captions/subtitles, extract the visual styling into a structured JSON object.

Analyze precisely:
- fontFamily: closest web-safe or Google Font match (e.g. "Inter", "Impact", "Montserrat", "Playfair Display")
- fontSize: estimated size in px (16-80 range)
- fontWeight: CSS weight (400, 600, 700, 800, 900)
- color: hex color of the main caption text
- backgroundColor: hex + alpha if there's a background box (e.g. "rgba(0,0,0,0.7)"), or undefined
- highlightColor: hex color if active/current word is highlighted differently, or undefined
- position: "top" | "center" | "bottom" based on where captions appear in frame
- animation: best match from "none" | "fade" | "pop" | "bounce" | "typewriter" | "karaoke" | "wave" | "word-fade" | "slide"
- textTransform: "none" | "uppercase" | "lowercase"
- textShadow: CSS text-shadow string if visible (e.g. "2px 2px 4px rgba(0,0,0,0.8)")
- stroke: CSS -webkit-text-stroke if visible (e.g. "2px black")

Return ONLY valid JSON matching this structure, no markdown fences, no explanation.`;

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
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json(
        { error: "No image provided. Send an image field in FormData." },
        { status: 400 }
      );
    }

    // Convert to base64 data URL
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = image.type || "image/png";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Call GPT-4o Vision
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze the caption/subtitle style in this screenshot. Return the JSON style object.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!gptRes.ok) {
      const errBody = await gptRes.text();
      console.error("GPT-4o Vision error:", gptRes.status, errBody);
      return NextResponse.json(
        { error: "GPT-4o Vision API error", detail: errBody },
        { status: gptRes.status }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gptData: any = await gptRes.json();
    const rawContent: string =
      gptData.choices?.[0]?.message?.content ?? "{}";

    // Strip possible markdown fences
    const cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse GPT response as JSON:", cleaned);
      return NextResponse.json(
        { error: "GPT returned invalid JSON", raw: cleaned },
        { status: 502 }
      );
    }

    // Build CaptionStyle with sensible defaults
    const style: CaptionStyle = {
      id: "cloned-style",
      name: "Cloned Style",
      category: "special",
      fontFamily: parsed.fontFamily ?? "Inter",
      fontSize: parsed.fontSize ?? 32,
      fontWeight: parsed.fontWeight ?? 700,
      color: parsed.color ?? "#FFFFFF",
      backgroundColor: parsed.backgroundColor ?? undefined,
      highlightColor: parsed.highlightColor ?? undefined,
      position: parsed.position ?? "bottom",
      animation: parsed.animation ?? "none",
      textTransform: parsed.textTransform ?? "none",
      textShadow: parsed.textShadow ?? undefined,
      stroke: parsed.stroke ?? undefined,
      preview: "Ai powered editing",
    };

    return NextResponse.json({ style });
  } catch (err) {
    console.error("Style-clone route error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
