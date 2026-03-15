import { NextRequest, NextResponse } from "next/server";
import * as ftp from "basic-ftp";
import { Readable } from "stream";
import path from "path";

const FTP_HOST = "45.84.204.132";
const FTP_USER = "u738932514";
const FTP_PASS = "H2e2l2o2##";
const FTP_REMOTE_DIR =
  "domains/aitendencijos.lt/public_html/uploads";
const PUBLIC_BASE_URL = "https://aitendencijos.lt/uploads";

// Max file size: 500 MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
  "video/mpeg",
];

function generateFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".mp4";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `video_${timestamp}_${random}${ext}`;
}

function bufferToReadable(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export async function POST(request: NextRequest) {
  let client: ftp.Client | null = null;

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No video file provided. Use field name 'video'." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const filename = generateFilename(file.name);

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const readableStream = bufferToReadable(buffer);

    // Upload via FTP
    client = new ftp.Client();
    client.ftp.verbose = false;

    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
    });

    // Ensure remote directory exists
    await client.ensureDir(`/${FTP_REMOTE_DIR}`);
    await client.cd(`/${FTP_REMOTE_DIR}`);

    // Upload the file
    await client.uploadFrom(readableStream, filename);

    const url = `${PUBLIC_BASE_URL}/${filename}`;

    return NextResponse.json({
      success: true,
      filename,
      url,
      size: file.size,
      type: file.type,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown upload error";
    console.error("[Upload API] Error:", message);

    return NextResponse.json(
      { success: false, error: `Upload failed: ${message}` },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.close();
    }
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed. Use POST with multipart/form-data." },
    { status: 405 }
  );
}
