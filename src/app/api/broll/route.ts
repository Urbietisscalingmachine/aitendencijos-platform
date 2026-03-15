/* ═══════════════════════════════════════════════════════════
   /api/broll — Pexels Video Search
   Searches Pexels Video API for stock B-roll clips
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { BrollClip } from "@/types/cineflow";

export const runtime = "nodejs";

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideoPicture {
  id: number;
  nr: number;
  picture: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
  url: string;
  user: { name: string; url: string };
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideo[];
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PEXELS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { query, perPage = 12 } = body as {
      query: string;
      perPage?: number;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const clampedPerPage = Math.min(Math.max(perPage, 1), 40);

    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", query.trim());
    url.searchParams.set("per_page", String(clampedPerPage));
    url.searchParams.set("orientation", "landscape");

    const pexelsRes = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });

    if (!pexelsRes.ok) {
      const errBody = await pexelsRes.text();
      console.error("Pexels API error:", pexelsRes.status, errBody);
      return NextResponse.json(
        { error: "Pexels API error", detail: errBody },
        { status: pexelsRes.status }
      );
    }

    const data: PexelsSearchResponse = await pexelsRes.json();

    // Map to BrollClip format — pick best quality HD file
    const clips: BrollClip[] = data.videos.map((video) => {
      // Prefer HD quality mp4
      const hdFile = video.video_files.find(
        (f) => f.quality === "hd" && f.file_type === "video/mp4"
      );
      // Fallback to SD mp4
      const sdFile = video.video_files.find(
        (f) => f.quality === "sd" && f.file_type === "video/mp4"
      );
      // Fallback to any mp4
      const anyFile = video.video_files.find(
        (f) => f.file_type === "video/mp4"
      );
      const bestFile = hdFile || sdFile || anyFile || video.video_files[0];

      return {
        id: `pexels-${video.id}`,
        src: bestFile?.link ?? "",
        thumbnail: video.image,
        duration: video.duration,
        source: "pexels" as const,
        overlayMode: "fullscreen" as const,
      };
    });

    return NextResponse.json({
      clips,
      total: data.total_results,
      query: query.trim(),
    });
  } catch (err) {
    console.error("Broll search error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
