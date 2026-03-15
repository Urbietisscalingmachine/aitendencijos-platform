/* ═══════════════════════════════════════════════════════════
   /api/upload — Video Upload to Vercel Blob Storage
   POST (FormData with "file") → { url, filename, size }
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

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

// ── Constants ────────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/x-msvideo", // .avi
  "video/avi",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-msvideo": ".avi",
  "video/avi": ".avi",
};

// ── POST handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Verify Blob token exists
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN not configured" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data. Send multipart/form-data with a 'file' field." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing 'file' field in form data" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB. Got: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        },
        { status: 413, headers: CORS_HEADERS }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate MIME type
    const mimeType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error: `Invalid file type: "${mimeType}". Allowed: mp4, mov, webm, avi`,
        },
        { status: 415, headers: CORS_HEADERS }
      );
    }

    // Build filename
    const originalName =
      file instanceof File ? file.name : `upload${MIME_EXTENSIONS[mimeType] || ".mp4"}`;
    const timestamp = Date.now();
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `cineflow/videos/${timestamp}-${sanitized}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, file, {
      access: "public",
      contentType: mimeType,
    });

    return NextResponse.json(
      {
        url: blob.url,
        filename: originalName,
        size: file.size,
        contentType: mimeType,
        pathname: blob.pathname,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[Upload] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Upload failed", detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
