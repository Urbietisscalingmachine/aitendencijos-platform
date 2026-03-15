import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranscribeRequest {
  videoUrl: string;
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface TranscribeResponse {
  success: boolean;
  transcript?: string;
  words?: WordTimestamp[];
  error?: string;
}

/**
 * Downloads a video/audio file from a URL and saves it to a temp path.
 * Returns the local file path.
 */
async function downloadFile(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let extension = ".mp4";

  if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) {
    extension = ".mp3";
  } else if (contentType.includes("audio/wav")) {
    extension = ".wav";
  } else if (contentType.includes("audio/webm") || contentType.includes("video/webm")) {
    extension = ".webm";
  } else if (contentType.includes("video/mp4")) {
    extension = ".mp4";
  } else if (contentType.includes("audio/m4a") || contentType.includes("audio/mp4")) {
    extension = ".m4a";
  }

  // Also try to detect extension from URL
  const urlPath = new URL(url).pathname;
  const urlExt = urlPath.match(/\.(mp4|mp3|wav|webm|m4a|ogg|flac|mpeg)(\?|$)/i);
  if (urlExt) {
    extension = `.${urlExt[1].toLowerCase()}`;
  }

  const tempDir = join(tmpdir(), "transcribe");
  await mkdir(tempDir, { recursive: true });

  const filename = `${randomUUID()}${extension}`;
  const filePath = join(tempDir, filename);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("Downloaded file is empty");
  }

  // Whisper has a 25MB limit
  const maxSize = 25 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error(
      `File too large for Whisper API (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max is 25MB.`
    );
  }

  await writeFile(filePath, buffer);
  return filePath;
}

/**
 * Cleans up a temporary file. Silently ignores errors.
 */
async function cleanupFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  let tempFilePath: string | null = null;

  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    let body: TranscribeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { videoUrl } = body;

    // Validate videoUrl
    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'videoUrl' field" },
        { status: 400 }
      );
    }

    try {
      new URL(videoUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Step 1: Download the video/audio file
    console.log(`[transcribe] Downloading file from: ${videoUrl}`);
    tempFilePath = await downloadFile(videoUrl);
    console.log(`[transcribe] Downloaded to: ${tempFilePath}`);

    // Step 2: Send to OpenAI Whisper API with word-level timestamps
    console.log("[transcribe] Sending to Whisper API...");

    const file = await import("fs").then((fs) =>
      fs.createReadStream(tempFilePath!)
    );

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: file,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    console.log("[transcribe] Transcription complete");

    // Step 3: Extract word-level timestamps
    const words: WordTimestamp[] = (
      (transcription as any).words || []
    ).map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    const transcript = transcription.text || "";

    return NextResponse.json({
      success: true,
      transcript,
      words,
    });
  } catch (error: any) {
    console.error("[transcribe] Error:", error);

    // Handle specific OpenAI errors
    if (error?.status === 401) {
      return NextResponse.json(
        { success: false, error: "Invalid OpenAI API key" },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: "OpenAI rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  } finally {
    // Always clean up temp file
    if (tempFilePath) {
      await cleanupFile(tempFilePath);
    }
  }
}
