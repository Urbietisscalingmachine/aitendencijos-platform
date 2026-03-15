/* ═══════════════════════════════════════════════════════════
   /api/broll-generate — WaveSpeed Multi-Model AI Video Gen
   Supports: Kling 3.0, Sora 2, Veo 3.1
   Generates cinematic B-roll via WaveSpeed text-to-video API
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 180; // Sora/Veo can take longer

// ── CORS headers ─────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

// ── Model types & config ─────────────────────────────────

type ModelId = "kling-3.0" | "sora-2" | "veo-3.1";

interface ModelConfig {
  endpoint: string;
  buildPayload: (params: {
    prompt: string;
    negativePrompt: string;
    duration: number;
    aspectRatio: "16:9" | "9:16";
  }) => Record<string, unknown>;
  estimatedCost: string;
  maxWaitMs: number;
  source: string;
}

const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  "kling-3.0": {
    endpoint:
      "https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-std/text-to-video",
    buildPayload: ({ prompt, negativePrompt, duration, aspectRatio }) => ({
      prompt,
      negative_prompt: negativePrompt,
      duration: Math.min(Math.max(duration, 5), 10),
      aspect_ratio: aspectRatio,
      cfg_scale: 0.5,
    }),
    estimatedCost: "$0.50",
    maxWaitMs: 120_000,
    source: "kling",
  },
  "sora-2": {
    endpoint:
      "https://api.wavespeed.ai/api/v3/openai/sora/text-to-video",
    buildPayload: ({ prompt, duration, aspectRatio }) => ({
      prompt,
      duration: Math.min(Math.max(duration, 5), 10),
      size: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
      n_variants: 1,
    }),
    estimatedCost: "$0.75",
    maxWaitMs: 180_000,
    source: "sora",
  },
  "veo-3.1": {
    endpoint:
      "https://api.wavespeed.ai/api/v3/google/veo-3.1/text-to-video",
    buildPayload: ({ prompt, negativePrompt, duration, aspectRatio }) => ({
      prompt,
      negative_prompt: negativePrompt,
      duration: Math.min(Math.max(duration, 5), 10),
      aspect_ratio: aspectRatio,
      enhance_prompt: true,
    }),
    estimatedCost: "$1.50",
    maxWaitMs: 180_000,
    source: "veo",
  },
};

const VALID_MODELS = Object.keys(MODEL_CONFIGS) as ModelId[];

// ── Cinematic prompt engineering presets ──────────────────

const SHOT_TYPE_MAP: Record<string, string> = {
  "close-up":
    "extreme close-up shot, shallow depth of field, intimate framing",
  aerial: "aerial drone shot, bird's eye view, sweeping landscape",
  tracking:
    "smooth tracking shot, following the subject, lateral movement",
  dolly: "dolly zoom shot, dramatic perspective shift, Hitchcock effect",
  macro: "macro lens shot, extreme detail, razor-thin focus plane",
  wide: "wide establishing shot, grand scale, environmental context",
};

const LIGHTING_MAP: Record<string, string> = {
  "golden hour": "warm golden hour lighting, long shadows, amber tones",
  neon: "neon-lit, cyberpunk atmosphere, vivid color spill, reflections",
  moody: "moody low-key lighting, deep shadows, chiaroscuro",
  "high-key": "bright high-key lighting, clean, airy, minimal shadows",
  "dramatic shadow":
    "dramatic rim lighting, silhouette edges, volumetric light rays",
};

const CAMERA_MAP: Record<string, string> = {
  "shallow DOF":
    "shallow depth of field, bokeh background, f/1.4 aperture",
  "lens flare": "anamorphic lens flare, cinematic highlight bloom",
  anamorphic:
    "anamorphic widescreen, oval bokeh, 2.39:1 cinematic look",
  handheld: "handheld camera, subtle organic shake, documentary feel",
  steadicam: "smooth steadicam glide, fluid stabilized movement",
};

const MOVEMENT_MAP: Record<string, string> = {
  "slow-mo":
    "slow motion 120fps, dramatic time stretch, fluid detail",
  timelapse:
    "timelapse photography, accelerated motion, passage of time",
  parallax:
    "parallax depth movement, layered foreground/background shift",
  orbit: "orbiting camera movement, 360-degree rotation around subject",
};

const STYLE_PRESETS: Record<string, string> = {
  cinematic:
    "cinematic color grading, film grain, 24fps motion blur, widescreen composition",
  urban:
    "urban street photography, gritty textures, city atmosphere, concrete and glass",
  nature:
    "natural organic beauty, lush vegetation, earth tones, environmental documentary",
  tech:
    "futuristic technology, holographic interfaces, clean minimal design, digital precision",
  corporate:
    "professional corporate aesthetic, clean lines, modern office, polished surfaces",
  dramatic:
    "high drama, intense contrast, emotional atmosphere, powerful visual impact",
};

const NEGATIVE_PROMPT =
  "blurry, low quality, artifacts, text, watermark, distorted, deformed, pixelated, noisy, overexposed, underexposed, cartoon, anime, illustration, painting, sketch, unrealistic";

// ── Build cinematic prompt ───────────────────────────────

function buildCinematicPrompt(params: {
  prompt: string;
  style: string;
  shotType?: string;
  lighting?: string;
  camera?: string;
  movement?: string;
}): string {
  const parts: string[] = [];

  // Style preset
  const styleDesc = STYLE_PRESETS[params.style] || STYLE_PRESETS.cinematic;
  parts.push(styleDesc);

  // Shot type
  if (params.shotType && SHOT_TYPE_MAP[params.shotType]) {
    parts.push(SHOT_TYPE_MAP[params.shotType]);
  }

  // Lighting
  if (params.lighting && LIGHTING_MAP[params.lighting]) {
    parts.push(LIGHTING_MAP[params.lighting]);
  }

  // Camera
  if (params.camera && CAMERA_MAP[params.camera]) {
    parts.push(CAMERA_MAP[params.camera]);
  }

  // Movement
  if (params.movement && MOVEMENT_MAP[params.movement]) {
    parts.push(MOVEMENT_MAP[params.movement]);
  }

  // User's original prompt at the end for emphasis
  parts.push(params.prompt);

  // Professional quality markers
  parts.push(
    "professional cinematography, 4K resolution, high production value"
  );

  return parts.join(", ");
}

// ── WaveSpeed polling ────────────────────────────────────

async function pollWaveSpeed(
  requestId: string,
  apiKey: string,
  maxWaitMs = 120_000,
  intervalMs = 3_000
): Promise<{ videoUrl: string }> {
  const deadline = Date.now() + maxWaitMs;
  const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`;

  while (Date.now() < deadline) {
    const res = await fetch(pollUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      // Transient errors → keep polling
      if (res.status >= 500) {
        console.warn("[WaveSpeed poll] Server error, retrying:", res.status, errText);
        await sleep(intervalMs);
        continue;
      }
      throw new Error(`WaveSpeed poll error ${res.status}: ${errText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const status: string = data.status || data.data?.status || "";

    if (status === "completed" || status === "succeeded") {
      const videoUrl =
        data.output?.video_url ||
        data.output?.file_url ||
        data.data?.output?.video_url ||
        data.result?.video_url ||
        "";
      if (!videoUrl) {
        throw new Error("WaveSpeed completed but no video_url in response");
      }
      return { videoUrl };
    }

    if (status === "failed" || status === "error" || status === "canceled") {
      throw new Error(`WaveSpeed generation failed: ${status} — ${JSON.stringify(data)}`);
    }

    // Still processing — wait and try again
    await sleep(intervalMs);
  }

  throw new Error(`WaveSpeed generation timed out (${Math.round(maxWaitMs / 1000)}s)`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── API Handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "WAVESPEED_API_KEY not configured" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const body = await req.json();
    const {
      prompt,
      duration = 5,
      style = "cinematic",
      aspectRatio = "16:9",
      model = "kling-3.0",
      shotType,
      lighting,
      camera,
      movement,
    } = body as {
      prompt: string;
      duration?: number;
      style?: string;
      aspectRatio?: "16:9" | "9:16";
      model?: ModelId;
      shotType?: string;
      lighting?: string;
      camera?: string;
      movement?: string;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate model
    if (!VALID_MODELS.includes(model)) {
      return NextResponse.json(
        {
          error: `Invalid model. Valid: ${VALID_MODELS.join(", ")}`,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate style
    if (style && !STYLE_PRESETS[style]) {
      return NextResponse.json(
        {
          error: `Invalid style. Valid: ${Object.keys(STYLE_PRESETS).join(", ")}`,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const modelConfig = MODEL_CONFIGS[model];

    // Build the enhanced cinematic prompt
    const cinematicPrompt = buildCinematicPrompt({
      prompt: prompt.trim(),
      style,
      shotType,
      lighting,
      camera,
      movement,
    });

    // ── Step 1: Build model-specific payload ─────────
    const payload = modelConfig.buildPayload({
      prompt: cinematicPrompt,
      negativePrompt: NEGATIVE_PROMPT,
      duration,
      aspectRatio: aspectRatio as "16:9" | "9:16",
    });

    // ── Step 2: Submit generation to WaveSpeed ───────
    const submitRes = await fetch(modelConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      console.error(`[WaveSpeed/${model}] Submit error:`, submitRes.status, errBody);
      return NextResponse.json(
        { error: "WaveSpeed API error", detail: errBody },
        { status: submitRes.status, headers: CORS_HEADERS }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitData: any = await submitRes.json();
    const requestId: string =
      submitData.id || submitData.data?.id || submitData.request_id || "";

    if (!requestId) {
      console.error(`[WaveSpeed/${model}] No request ID in response:`, submitData);
      return NextResponse.json(
        { error: "WaveSpeed returned no request ID", detail: JSON.stringify(submitData) },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    // ── Step 3: Poll until completed ─────────────────
    const { videoUrl } = await pollWaveSpeed(
      requestId,
      apiKey,
      modelConfig.maxWaitMs,
      3_000
    );

    // Generate a thumbnail URL (first frame) — many CDNs support adding params
    const thumbnail = videoUrl.replace(/\.[^.]+$/, "_thumb.jpg") || videoUrl;

    return NextResponse.json(
      {
        videoUrl,
        thumbnail,
        duration,
        requestId,
        cinematicPrompt,
        originalPrompt: prompt.trim(),
        style,
        model,
        estimatedCost: modelConfig.estimatedCost,
        clip: {
          id: `wavespeed-${model}-${requestId}`,
          src: videoUrl,
          thumbnail,
          duration,
          source: modelConfig.source as "kling" | "sora" | "veo",
          overlayMode: "fullscreen" as const,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[broll-generate] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "B-roll generation failed", detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
