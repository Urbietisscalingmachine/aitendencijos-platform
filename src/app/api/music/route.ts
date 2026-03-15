/* ═══════════════════════════════════════════════════════════
   MUSIC API — Free Music Library
   GET /api/music?query=&genre=&mood=&page=
   30 curated royalty-free tracks with real Pixabay Music URLs
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import type { MusicTrack } from "@/types/cineflow";

// ── CORS headers ─────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

// ── Valid filter values ──────────────────────────────────

const VALID_GENRES = [
  "lo-fi", "cinematic", "corporate", "electronic", "acoustic", "ambient",
] as const;

const VALID_MOODS = [
  "happy", "sad", "dramatic", "chill", "energetic", "inspiring", "dark", "romantic",
] as const;

type Genre = typeof VALID_GENRES[number];
type Mood = typeof VALID_MOODS[number];

// ── Free Music Library (30 tracks) ───────────────────────
// URLs point to Pixabay free music downloads (royalty-free, no API key needed)

const MUSIC_LIBRARY: MusicTrack[] = [
  // ── Lo-fi (5) ──────────────────────────────────────
  {
    id: "lofi-001",
    title: "Lofi Study",
    artist: "FASSounds",
    genre: "lo-fi",
    mood: "chill",
    duration: 147,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    source: "pixabay",
  },
  {
    id: "lofi-002",
    title: "Chill Abstract",
    artist: "Coma-Media",
    genre: "lo-fi",
    mood: "chill",
    duration: 131,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946f883ca0.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946f883ca0.mp3",
    source: "pixabay",
  },
  {
    id: "lofi-003",
    title: "Good Night",
    artist: "FASSounds",
    genre: "lo-fi",
    mood: "sad",
    duration: 126,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3",
    source: "pixabay",
  },
  {
    id: "lofi-004",
    title: "Lofi Chill",
    artist: "BoDlegins",
    genre: "lo-fi",
    mood: "chill",
    duration: 168,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/07/19/audio_e8eb4fb6fa.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/07/19/audio_e8eb4fb6fa.mp3",
    source: "pixabay",
  },
  {
    id: "lofi-005",
    title: "Empty Mind",
    artist: "Lesfm",
    genre: "lo-fi",
    mood: "sad",
    duration: 119,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/10/09/audio_313428d1ec.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/10/09/audio_313428d1ec.mp3",
    source: "pixabay",
  },

  // ── Cinematic (5) ──────────────────────────────────
  {
    id: "cine-001",
    title: "Cinematic Documentary",
    artist: "Lexin_Music",
    genre: "cinematic",
    mood: "inspiring",
    duration: 151,
    previewUrl: "https://cdn.pixabay.com/download/audio/2024/02/14/audio_e4867a9eeb.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2024/02/14/audio_e4867a9eeb.mp3",
    source: "pixabay",
  },
  {
    id: "cine-002",
    title: "Epic Cinematic",
    artist: "SoundGalleryBy",
    genre: "cinematic",
    mood: "dramatic",
    duration: 122,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/02/19/audio_8a5e6fc430.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/02/19/audio_8a5e6fc430.mp3",
    source: "pixabay",
  },
  {
    id: "cine-003",
    title: "Documentary",
    artist: "Oleksii-Kaplunskyi",
    genre: "cinematic",
    mood: "inspiring",
    duration: 139,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/09/04/audio_0625753e28.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/09/04/audio_0625753e28.mp3",
    source: "pixabay",
  },
  {
    id: "cine-004",
    title: "Emotional Cinematic",
    artist: "Lesfm",
    genre: "cinematic",
    mood: "sad",
    duration: 172,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/08/31/audio_419263a958.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/08/31/audio_419263a958.mp3",
    source: "pixabay",
  },
  {
    id: "cine-005",
    title: "Inspiring Cinematic",
    artist: "Muzaproduction",
    genre: "cinematic",
    mood: "inspiring",
    duration: 196,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_370eb9b00e.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_370eb9b00e.mp3",
    source: "pixabay",
  },

  // ── Corporate (5) ──────────────────────────────────
  {
    id: "corp-001",
    title: "Motivational Corporate",
    artist: "MusicLFiles",
    genre: "corporate",
    mood: "inspiring",
    duration: 148,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/10/30/audio_5ed5307c08.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/10/30/audio_5ed5307c08.mp3",
    source: "pixabay",
  },
  {
    id: "corp-002",
    title: "Modern Business",
    artist: "Lesfm",
    genre: "corporate",
    mood: "energetic",
    duration: 117,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_56b40bf5ce.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_56b40bf5ce.mp3",
    source: "pixabay",
  },
  {
    id: "corp-003",
    title: "Technology Corporate",
    artist: "SoundGalleryBy",
    genre: "corporate",
    mood: "inspiring",
    duration: 130,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/08/25/audio_890c75a40c.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/08/25/audio_890c75a40c.mp3",
    source: "pixabay",
  },
  {
    id: "corp-004",
    title: "Upbeat Corporate",
    artist: "SoulProdMusic",
    genre: "corporate",
    mood: "happy",
    duration: 155,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/03/20/audio_d37f5bb3c9.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/03/20/audio_d37f5bb3c9.mp3",
    source: "pixabay",
  },
  {
    id: "corp-005",
    title: "Presentation Background",
    artist: "Lesfm",
    genre: "corporate",
    mood: "chill",
    duration: 143,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_56a4ab8a7d.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_56a4ab8a7d.mp3",
    source: "pixabay",
  },

  // ── Electronic (5) ─────────────────────────────────
  {
    id: "elec-001",
    title: "Powerful Beat",
    artist: "Coma-Media",
    genre: "electronic",
    mood: "energetic",
    duration: 178,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3",
    source: "pixabay",
  },
  {
    id: "elec-002",
    title: "Futuristic Beat",
    artist: "Muzaproduction",
    genre: "electronic",
    mood: "energetic",
    duration: 140,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3",
    source: "pixabay",
  },
  {
    id: "elec-003",
    title: "Synthwave Retrowave",
    artist: "Coma-Media",
    genre: "electronic",
    mood: "energetic",
    duration: 217,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/04/27/audio_67f1b5e649.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/04/27/audio_67f1b5e649.mp3",
    source: "pixabay",
  },
  {
    id: "elec-004",
    title: "Electronic Future Beats",
    artist: "QubeSounds",
    genre: "electronic",
    mood: "dark",
    duration: 162,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/04/11/audio_1e7cc1e682.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/04/11/audio_1e7cc1e682.mp3",
    source: "pixabay",
  },
  {
    id: "elec-005",
    title: "Deep House Chill",
    artist: "Lesfm",
    genre: "electronic",
    mood: "chill",
    duration: 195,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/02/08/audio_6566279f94.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/02/08/audio_6566279f94.mp3",
    source: "pixabay",
  },

  // ── Acoustic (5) ───────────────────────────────────
  {
    id: "acou-001",
    title: "Acoustic Breeze",
    artist: "Lesfm",
    genre: "acoustic",
    mood: "happy",
    duration: 134,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_fa4b4e7f30.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_fa4b4e7f30.mp3",
    source: "pixabay",
  },
  {
    id: "acou-002",
    title: "Acoustic Folk Happy",
    artist: "SoulProdMusic",
    genre: "acoustic",
    mood: "happy",
    duration: 149,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/09/10/audio_e51d94ec64.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/09/10/audio_e51d94ec64.mp3",
    source: "pixabay",
  },
  {
    id: "acou-003",
    title: "Beautiful Acoustic",
    artist: "Lesfm",
    genre: "acoustic",
    mood: "romantic",
    duration: 157,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/01/16/audio_1dd84f29ed.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/01/16/audio_1dd84f29ed.mp3",
    source: "pixabay",
  },
  {
    id: "acou-004",
    title: "Sad Acoustic Guitar",
    artist: "Muzaproduction",
    genre: "acoustic",
    mood: "sad",
    duration: 188,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/12/10/audio_60fa305e25.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/12/10/audio_60fa305e25.mp3",
    source: "pixabay",
  },
  {
    id: "acou-005",
    title: "Inspiring Acoustic",
    artist: "Lesfm",
    genre: "acoustic",
    mood: "inspiring",
    duration: 129,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/05/16/audio_541e35e3bd.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/05/16/audio_541e35e3bd.mp3",
    source: "pixabay",
  },

  // ── Ambient (5) ────────────────────────────────────
  {
    id: "ambi-001",
    title: "Ambient Piano",
    artist: "Lesfm",
    genre: "ambient",
    mood: "chill",
    duration: 210,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3",
    source: "pixabay",
  },
  {
    id: "ambi-002",
    title: "Deep Meditation",
    artist: "SoundGalleryBy",
    genre: "ambient",
    mood: "chill",
    duration: 252,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/06/07/audio_b9bd4170e4.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/06/07/audio_b9bd4170e4.mp3",
    source: "pixabay",
  },
  {
    id: "ambi-003",
    title: "Space Ambient",
    artist: "SergeQuadrado",
    genre: "ambient",
    mood: "dark",
    duration: 300,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/04/07/audio_ab22f5b4f5.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/04/07/audio_ab22f5b4f5.mp3",
    source: "pixabay",
  },
  {
    id: "ambi-004",
    title: "Calm Ambient",
    artist: "Lesfm",
    genre: "ambient",
    mood: "chill",
    duration: 180,
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/05/17/audio_5df4a79f57.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/05/17/audio_5df4a79f57.mp3",
    source: "pixabay",
  },
  {
    id: "ambi-005",
    title: "Dreamy Ambient",
    artist: "FASSounds",
    genre: "ambient",
    mood: "romantic",
    duration: 228,
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/09/01/audio_d4d1cf9531.mp3",
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/09/01/audio_d4d1cf9531.mp3",
    source: "pixabay",
  },
];

// ── GET handler ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.toLowerCase().trim() || "";
    const genre = searchParams.get("genre")?.toLowerCase().trim() || "";
    const mood = searchParams.get("mood")?.toLowerCase().trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = 20;

    // Validate optional filters
    if (genre && !VALID_GENRES.includes(genre as Genre)) {
      return NextResponse.json(
        { error: `Invalid genre. Valid: ${VALID_GENRES.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (mood && !VALID_MOODS.includes(mood as Mood)) {
      return NextResponse.json(
        { error: `Invalid mood. Valid: ${VALID_MOODS.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Filter tracks
    let tracks = MUSIC_LIBRARY.filter((track) => {
      if (genre && track.genre !== genre) return false;
      if (mood && track.mood !== mood) return false;
      if (query) {
        const haystack = `${track.title} ${track.artist} ${track.genre} ${track.mood}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });

    // Paginate
    const total = tracks.length;
    const startIdx = (page - 1) * perPage;
    tracks = tracks.slice(startIdx, startIdx + perPage);

    return NextResponse.json(
      {
        tracks,
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        genres: VALID_GENRES,
        moods: VALID_MOODS,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Music API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch music tracks" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
