/* ═══════════════════════════════════════════════════════════
   /api/style-clone-video — Reference Video B-Roll Analysis
   Uses Claude to analyze B-roll patterns from a reference video
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { StyleDNA } from "@/types/cineflow";

export const runtime = "nodejs";
export const maxDuration = 60;

interface FrameDescription {
  timestamp: number;
  description: string;
  isBroll: boolean;
  type?: "stock" | "ai-generated" | "screen-recording" | "talking-head";
}

interface AnalysisRequest {
  transcript: string;
  frameDescriptions: FrameDescription[];
  videoDuration: number;
  title?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body: AnalysisRequest = await req.json();
    const { transcript, frameDescriptions, videoDuration, title } = body;

    if (!transcript || !frameDescriptions || !videoDuration) {
      return NextResponse.json(
        {
          error:
            "Required: transcript, frameDescriptions, videoDuration",
        },
        { status: 400 }
      );
    }

    // Build frame analysis context for Claude
    const framesContext = frameDescriptions
      .map(
        (f) =>
          `[${f.timestamp.toFixed(1)}s] ${f.isBroll ? "[B-ROLL]" : "[MAIN]"} ${f.description}${f.type ? ` (${f.type})` : ""}`
      )
      .join("\n");

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a professional video editor analyzing B-roll patterns in a reference video.

VIDEO INFO:
- Title: ${title || "Unknown"}
- Duration: ${videoDuration}s

TRANSCRIPT:
${transcript}

FRAME-BY-FRAME ANALYSIS:
${framesContext}

Analyze the B-roll usage patterns and return a JSON object with EXACTLY this structure (no markdown, no explanation, just valid JSON):

{
  "frequency": <number — average seconds between B-roll insertions>,
  "avgDuration": <number — average B-roll clip duration in seconds>,
  "type": "<primary B-roll type: stock | ai-generated | screen-recording | mixed>",
  "style": "<description of the B-roll visual style, e.g., 'cinematic aerial shots with warm color grading'>",
  "patterns": {
    "totalBrollClips": <number>,
    "brollPercentage": <number — % of video that is B-roll>,
    "insertionPoints": "<description of when B-roll typically appears, e.g., 'at topic transitions and when introducing new concepts'>",
    "transitionStyle": "<how B-roll is introduced: cut | crossfade | zoom | slide>",
    "dominantShotTypes": ["<shot type 1>", "<shot type 2>"],
    "dominantMoods": ["<mood 1>", "<mood 2>"]
  }
}`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errBody);
      return NextResponse.json(
        { error: "Claude API error", detail: errBody },
        { status: claudeRes.status }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claudeData: any = await claudeRes.json();
    const responseText =
      claudeData.content?.[0]?.text || "";

    // Parse Claude's JSON response
    let brollAnalysis;
    try {
      // Extract JSON from response (handle cases where Claude wraps in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Claude response");
      }
      brollAnalysis = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", responseText);
      return NextResponse.json(
        {
          error: "Failed to parse analysis",
          raw: responseText,
        },
        { status: 500 }
      );
    }

    // Build StyleDNA.broll object
    const brollDNA: StyleDNA["broll"] = {
      frequency: brollAnalysis.frequency ?? 15,
      avgDuration: brollAnalysis.avgDuration ?? 3,
      type: brollAnalysis.type ?? "mixed",
      style: brollAnalysis.style ?? "standard stock footage",
    };

    return NextResponse.json({
      broll: brollDNA,
      patterns: brollAnalysis.patterns ?? null,
      raw: brollAnalysis,
    });
  } catch (err) {
    console.error("Style clone video error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
