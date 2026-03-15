"use client";

/* ═══════════════════════════════════════════════════════════
   AUDIO ENGINE — Full audio processing panel for Cineflow
   Tabs: Music Browser, Silence Removal, Audio Ducking,
         Audio Mix, Sound Effects
   ═══════════════════════════════════════════════════════════ */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { MusicTrack, AudioSettings, SilenceSegment } from "@/types/cineflow";
import AudioWaveform from "./AudioWaveform";

// ── Types ────────────────────────────────────────────────
type Tab = "music" | "silence" | "ducking" | "mix" | "sfx";

interface AudioEngineProps {
  audioUrl?: string;
  transcript?: string;
  onSettingsChange?: (settings: AudioSettings) => void;
  onAddTrack?: (track: MusicTrack) => void;
  onSilenceRemoval?: (segments: SilenceSegment[], action: string) => void;
}

interface SoundEffect {
  id: string;
  name: string;
  category: string;
  previewUrl: string;
  duration: number;
}

// ── Constants ────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "music",
    label: "Music",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: "silence",
    label: "Silence",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .78-.13 1.53-.36 2.24" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    id: "ducking",
    label: "Ducking",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
  {
    id: "mix",
    label: "Mix",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    id: "sfx",
    label: "SFX",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
];

const GENRES = [
  "lo-fi", "cinematic", "corporate", "electronic",
  "acoustic", "hip-hop", "ambient", "pop", "rock", "classical",
];

const MOODS = [
  "happy", "sad", "dramatic", "chill",
  "energetic", "inspiring", "dark", "romantic",
];

const SFX_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Whoosh", icon: "💨" },
  { name: "Pop", icon: "🫧" },
  { name: "Click", icon: "🔘" },
  { name: "Notification", icon: "🔔" },
  { name: "Impact", icon: "💥" },
  { name: "Ambient", icon: "🌊" },
];

// ── Built-in SFX library (placeholders) ─────────────────
const BUILTIN_SFX: Record<string, SoundEffect[]> = {
  Whoosh: [
    { id: "whoosh-1", name: "Fast Whoosh", category: "Whoosh", previewUrl: "", duration: 0.5 },
    { id: "whoosh-2", name: "Slow Whoosh", category: "Whoosh", previewUrl: "", duration: 0.8 },
    { id: "whoosh-3", name: "Deep Whoosh", category: "Whoosh", previewUrl: "", duration: 0.6 },
    { id: "whoosh-4", name: "Light Whoosh", category: "Whoosh", previewUrl: "", duration: 0.3 },
    { id: "whoosh-5", name: "Reverse Whoosh", category: "Whoosh", previewUrl: "", duration: 0.7 },
    { id: "whoosh-6", name: "Double Whoosh", category: "Whoosh", previewUrl: "", duration: 1.0 },
  ],
  Pop: [
    { id: "pop-1", name: "Bubble Pop", category: "Pop", previewUrl: "", duration: 0.2 },
    { id: "pop-2", name: "Cork Pop", category: "Pop", previewUrl: "", duration: 0.3 },
    { id: "pop-3", name: "Soft Pop", category: "Pop", previewUrl: "", duration: 0.15 },
    { id: "pop-4", name: "Bright Pop", category: "Pop", previewUrl: "", duration: 0.2 },
    { id: "pop-5", name: "Cartoon Pop", category: "Pop", previewUrl: "", duration: 0.25 },
  ],
  Click: [
    { id: "click-1", name: "UI Click", category: "Click", previewUrl: "", duration: 0.1 },
    { id: "click-2", name: "Camera Shutter", category: "Click", previewUrl: "", duration: 0.15 },
    { id: "click-3", name: "Toggle Click", category: "Click", previewUrl: "", duration: 0.08 },
    { id: "click-4", name: "Switch Click", category: "Click", previewUrl: "", duration: 0.12 },
    { id: "click-5", name: "Pen Click", category: "Click", previewUrl: "", duration: 0.1 },
    { id: "click-6", name: "Mouse Click", category: "Click", previewUrl: "", duration: 0.05 },
    { id: "click-7", name: "Metal Click", category: "Click", previewUrl: "", duration: 0.1 },
  ],
  Notification: [
    { id: "notif-1", name: "Ding", category: "Notification", previewUrl: "", duration: 0.5 },
    { id: "notif-2", name: "Chime", category: "Notification", previewUrl: "", duration: 0.8 },
    { id: "notif-3", name: "Bell", category: "Notification", previewUrl: "", duration: 0.6 },
    { id: "notif-4", name: "Alert Tone", category: "Notification", previewUrl: "", duration: 0.4 },
    { id: "notif-5", name: "Success", category: "Notification", previewUrl: "", duration: 0.7 },
    { id: "notif-6", name: "Message", category: "Notification", previewUrl: "", duration: 0.5 },
  ],
  Impact: [
    { id: "impact-1", name: "Bass Drop", category: "Impact", previewUrl: "", duration: 0.8 },
    { id: "impact-2", name: "Cinematic Hit", category: "Impact", previewUrl: "", duration: 1.2 },
    { id: "impact-3", name: "Drum Hit", category: "Impact", previewUrl: "", duration: 0.5 },
    { id: "impact-4", name: "Metal Clang", category: "Impact", previewUrl: "", duration: 0.6 },
    { id: "impact-5", name: "Sub Drop", category: "Impact", previewUrl: "", duration: 1.5 },
    { id: "impact-6", name: "Boom", category: "Impact", previewUrl: "", duration: 1.0 },
    { id: "impact-7", name: "Slam", category: "Impact", previewUrl: "", duration: 0.4 },
    { id: "impact-8", name: "Thunder", category: "Impact", previewUrl: "", duration: 2.0 },
  ],
  Ambient: [
    { id: "amb-1", name: "Rain", category: "Ambient", previewUrl: "", duration: 10 },
    { id: "amb-2", name: "Wind", category: "Ambient", previewUrl: "", duration: 8 },
    { id: "amb-3", name: "Forest", category: "Ambient", previewUrl: "", duration: 12 },
    { id: "amb-4", name: "City Traffic", category: "Ambient", previewUrl: "", duration: 10 },
    { id: "amb-5", name: "Ocean Waves", category: "Ambient", previewUrl: "", duration: 15 },
    { id: "amb-6", name: "Coffee Shop", category: "Ambient", previewUrl: "", duration: 10 },
  ],
};

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════
export default function AudioEngine({
  audioUrl = "",
  transcript = "",
  onSettingsChange,
  onAddTrack,
  onSilenceRemoval,
}: AudioEngineProps) {
  // ── State ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("music");

  // Music browser
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [page, setPage] = useState(1);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    genre: string;
    mood: string;
    reasoning: string;
  } | null>(null);

  // Silence removal
  const [silenceThreshold, setSilenceThreshold] = useState(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);
  const [silenceAction, setSilenceAction] = useState<"cut" | "speedup" | "none">("cut");
  const [speedMultiplier, setSpeedMultiplier] = useState(3);
  const [detectedSilences, setDetectedSilences] = useState<SilenceSegment[]>([]);
  const [showAfterPreview, setShowAfterPreview] = useState(false);

  // Ducking
  const [duckSpeaking, setDuckSpeaking] = useState(20);
  const [duckSilent, setDuckSilent] = useState(80);
  const [fadeSpeed, setFadeSpeed] = useState<"fast" | "medium" | "slow">("medium");
  const [speechRegions, setSpeechRegions] = useState<SilenceSegment[]>([]);

  // Audio mix
  const [videoVolume, setVideoVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(50);
  const [sfxVolume, setSfxVolume] = useState(70);
  const [masterVolume, setMasterVolume] = useState(100);
  const [fadeIn, setFadeIn] = useState(1);
  const [fadeOut, setFadeOut] = useState(2);
  const [videoMuted, setVideoMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);

  // SFX
  const [sfxCategory, setSfxCategory] = useState("Whoosh");
  const [sfxSearchQuery, setSfxSearchQuery] = useState("");
  const [freesoundResults, setFreesoundResults] = useState<SoundEffect[]>([]);
  const [isLoadingSfx, setIsLoadingSfx] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Computed ───────────────────────────────────────
  const totalSilenceDuration = useMemo(
    () => detectedSilences.reduce((sum, s) => sum + s.duration, 0),
    [detectedSilences]
  );

  // ── Emit settings changes ─────────────────────────
  useEffect(() => {
    onSettingsChange?.({
      videoVolume: videoMuted ? 0 : videoVolume / 100,
      musicVolume: musicMuted ? 0 : musicVolume / 100,
      duckingLevel: duckSpeaking / 100,
      fadeInDuration: fadeIn,
      fadeOutDuration: fadeOut,
      silenceThreshold,
      silenceAction,
      silenceSpeedMultiplier: speedMultiplier,
    });
  }, [
    videoVolume, musicVolume, videoMuted, musicMuted,
    duckSpeaking, fadeIn, fadeOut, silenceThreshold,
    silenceAction, speedMultiplier, onSettingsChange,
  ]);

  // ── Music search ──────────────────────────────────
  const searchMusic = useCallback(
    async (p = 1) => {
      setIsLoadingTracks(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("query", searchQuery);
        if (selectedGenre) params.set("genre", selectedGenre);
        if (selectedMood) params.set("mood", selectedMood);
        params.set("page", p.toString());

        const res = await fetch(`/api/music?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (p === 1) {
            setTracks(data.tracks || []);
          } else {
            setTracks((prev) => [...prev, ...(data.tracks || [])]);
          }
          setPage(p);
        }
      } catch (e) {
        console.error("Music search failed:", e);
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [searchQuery, selectedGenre, selectedMood]
  );

  // Initial load
  useEffect(() => {
    searchMusic(1);
  }, [selectedGenre, selectedMood]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI Suggestion ─────────────────────────────────
  const handleAiSuggest = useCallback(async () => {
    if (!transcript) return;
    setAiSuggesting(true);
    try {
      const res = await fetch("/api/music/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion({
          genre: data.genre,
          mood: data.mood,
          reasoning: data.reasoning,
        });
        if (data.tracks?.length) {
          setTracks(data.tracks);
        }
        setSelectedGenre(data.genre);
        setSelectedMood(data.mood);
      }
    } catch (e) {
      console.error("AI suggestion failed:", e);
    } finally {
      setAiSuggesting(false);
    }
  }, [transcript]);

  // ── Track playback ────────────────────────────────
  const togglePlay = useCallback(
    (track: MusicTrack) => {
      if (playingTrackId === track.id) {
        audioRef.current?.pause();
        setPlayingTrackId(null);
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (track.previewUrl) {
          const audio = new Audio(track.previewUrl);
          audio.volume = 0.5;
          audio.play().catch(() => {});
          audio.onended = () => setPlayingTrackId(null);
          audioRef.current = audio;
        }
        setPlayingTrackId(track.id);
      }
    },
    [playingTrackId]
  );

  // ── Silence detection (simulated from waveform) ───
  const handleWaveformReady = useCallback(
    (peaks: Float32Array, duration: number) => {
      if (!peaks || peaks.length === 0 || duration === 0) return;

      const silences: SilenceSegment[] = [];
      // Convert threshold from dB to linear amplitude
      const thresholdLinear = Math.pow(10, silenceThreshold / 20);
      const minSamples = Math.floor(
        (minSilenceDuration / duration) * peaks.length
      );

      let silenceStart = -1;
      let consecutiveSilent = 0;

      for (let i = 0; i < peaks.length; i++) {
        if (peaks[i] < thresholdLinear) {
          if (silenceStart === -1) silenceStart = i;
          consecutiveSilent++;
        } else {
          if (consecutiveSilent >= minSamples && silenceStart !== -1) {
            const start = (silenceStart / peaks.length) * duration;
            const end = (i / peaks.length) * duration;
            silences.push({ start, end, duration: end - start });
          }
          silenceStart = -1;
          consecutiveSilent = 0;
        }
      }

      // Check trailing silence
      if (consecutiveSilent >= minSamples && silenceStart !== -1) {
        const start = (silenceStart / peaks.length) * duration;
        silences.push({ start, end: duration, duration: duration - start });
      }

      setDetectedSilences(silences);

      // Generate speech regions (inverse of silence) for ducking tab
      const speeches: SilenceSegment[] = [];
      let lastEnd = 0;
      for (const s of silences) {
        if (s.start > lastEnd) {
          speeches.push({ start: lastEnd, end: s.start, duration: s.start - lastEnd });
        }
        lastEnd = s.end;
      }
      if (lastEnd < duration) {
        speeches.push({ start: lastEnd, end: duration, duration: duration - lastEnd });
      }
      setSpeechRegions(speeches);
    },
    [silenceThreshold, minSilenceDuration]
  );

  // Re-detect when threshold/duration changes
  useEffect(() => {
    // Trigger re-analysis by resetting (waveform will call onWaveformReady again)
    setDetectedSilences([]);
  }, [silenceThreshold, minSilenceDuration]);

  // ── Freesound SFX search ──────────────────────────
  const searchFreesound = useCallback(async () => {
    if (!sfxSearchQuery) return;
    setIsLoadingSfx(true);
    try {
      const params = new URLSearchParams({
        query: sfxSearchQuery,
        page_size: "10",
        fields: "id,name,username,duration,tags,previews",
      });
      const key = process.env.NEXT_PUBLIC_FREESOUND_API_KEY;
      if (key) params.set("token", key);

      const res = await fetch(
        `https://freesound.org/apiv2/search/text/?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setFreesoundResults(
          (data.results || []).map(
            (r: {
              id: number;
              name: string;
              tags: string[];
              previews?: { "preview-hq-mp3"?: string };
              duration: number;
            }) => ({
              id: `fs-${r.id}`,
              name: r.name,
              category: r.tags?.[0] || "misc",
              previewUrl: r.previews?.["preview-hq-mp3"] || "",
              duration: Math.round(r.duration * 10) / 10,
            })
          )
        );
      }
    } catch (e) {
      console.error("Freesound search failed:", e);
    } finally {
      setIsLoadingSfx(false);
    }
  }, [sfxSearchQuery]);

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <div
      className="flex flex-col h-full rounded-xl border overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(9,9,11,0.95) 0%, rgba(24,24,27,0.9) 100%)",
        borderColor: "rgba(139,92,246,0.15)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* ── Tab bar ─────────────────────────────────── */}
      <div
        className="flex gap-1 px-3 pt-3 pb-0 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium
              transition-all duration-200
              ${
                activeTab === tab.id
                  ? "text-white bg-white/[0.08] border-b-2"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
              }
            `}
            style={
              activeTab === tab.id
                ? { borderBottomColor: "#8B5CF6" }
                : undefined
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 400 }}>
        {activeTab === "music" && (
          <MusicBrowserTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
            selectedMood={selectedMood}
            setSelectedMood={setSelectedMood}
            tracks={tracks}
            isLoading={isLoadingTracks}
            playingTrackId={playingTrackId}
            onSearch={() => searchMusic(1)}
            onLoadMore={() => searchMusic(page + 1)}
            onTogglePlay={togglePlay}
            onAddTrack={onAddTrack}
            onAiSuggest={handleAiSuggest}
            aiSuggesting={aiSuggesting}
            aiSuggestion={aiSuggestion}
            hasTranscript={!!transcript}
          />
        )}

        {activeTab === "silence" && (
          <SilenceRemovalTab
            audioUrl={audioUrl}
            silenceThreshold={silenceThreshold}
            setSilenceThreshold={setSilenceThreshold}
            minSilenceDuration={minSilenceDuration}
            setMinSilenceDuration={setMinSilenceDuration}
            silenceAction={silenceAction}
            setSilenceAction={setSilenceAction}
            speedMultiplier={speedMultiplier}
            setSpeedMultiplier={setSpeedMultiplier}
            detectedSilences={detectedSilences}
            totalSilenceDuration={totalSilenceDuration}
            showAfterPreview={showAfterPreview}
            setShowAfterPreview={setShowAfterPreview}
            onWaveformReady={handleWaveformReady}
            onApply={() =>
              onSilenceRemoval?.(detectedSilences, silenceAction)
            }
          />
        )}

        {activeTab === "ducking" && (
          <AudioDuckingTab
            audioUrl={audioUrl}
            speechRegions={speechRegions}
            duckSpeaking={duckSpeaking}
            setDuckSpeaking={setDuckSpeaking}
            duckSilent={duckSilent}
            setDuckSilent={setDuckSilent}
            fadeSpeed={fadeSpeed}
            setFadeSpeed={setFadeSpeed}
          />
        )}

        {activeTab === "mix" && (
          <AudioMixTab
            audioUrl={audioUrl}
            videoVolume={videoVolume}
            setVideoVolume={setVideoVolume}
            musicVolume={musicVolume}
            setMusicVolume={setMusicVolume}
            sfxVolume={sfxVolume}
            setSfxVolume={setSfxVolume}
            masterVolume={masterVolume}
            setMasterVolume={setMasterVolume}
            fadeIn={fadeIn}
            setFadeIn={setFadeIn}
            fadeOut={fadeOut}
            setFadeOut={setFadeOut}
            videoMuted={videoMuted}
            setVideoMuted={setVideoMuted}
            musicMuted={musicMuted}
            setMusicMuted={setMusicMuted}
            sfxMuted={sfxMuted}
            setSfxMuted={setSfxMuted}
          />
        )}

        {activeTab === "sfx" && (
          <SoundEffectsTab
            sfxCategory={sfxCategory}
            setSfxCategory={setSfxCategory}
            sfxSearchQuery={sfxSearchQuery}
            setSfxSearchQuery={setSfxSearchQuery}
            freesoundResults={freesoundResults}
            isLoading={isLoadingSfx}
            onSearch={searchFreesound}
            onAddEffect={(sfx) => {
              onAddTrack?.({
                id: sfx.id,
                title: sfx.name,
                artist: "SFX",
                genre: sfx.category,
                mood: "",
                duration: sfx.duration,
                previewUrl: sfx.previewUrl,
                downloadUrl: sfx.previewUrl,
                source: "freesound",
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// MUSIC BROWSER TAB
// ═════════════════════════════════════════════════════════
function MusicBrowserTab({
  searchQuery,
  setSearchQuery,
  selectedGenre,
  setSelectedGenre,
  selectedMood,
  setSelectedMood,
  tracks,
  isLoading,
  playingTrackId,
  onSearch,
  onLoadMore,
  onTogglePlay,
  onAddTrack,
  onAiSuggest,
  aiSuggesting,
  aiSuggestion,
  hasTranscript,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedGenre: string | null;
  setSelectedGenre: (g: string | null) => void;
  selectedMood: string | null;
  setSelectedMood: (m: string | null) => void;
  tracks: MusicTrack[];
  isLoading: boolean;
  playingTrackId: string | null;
  onSearch: () => void;
  onLoadMore: () => void;
  onTogglePlay: (track: MusicTrack) => void;
  onAddTrack?: (track: MusicTrack) => void;
  onAiSuggest: () => void;
  aiSuggesting: boolean;
  aiSuggestion: { genre: string; mood: string; reasoning: string } | null;
  hasTranscript: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Search bar + AI suggest */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search music..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 pl-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <button
          onClick={onSearch}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
          }}
        >
          Search
        </button>

        {hasTranscript && (
          <button
            onClick={onAiSuggest}
            disabled={aiSuggesting}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
            style={{
              background: aiSuggesting
                ? "rgba(139,92,246,0.3)"
                : "linear-gradient(135deg, #6D28D9 0%, #4C1D95 100%)",
            }}
          >
            {aiSuggesting ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                AI Suggest
              </>
            )}
          </button>
        )}
      </div>

      {/* AI Suggestion result */}
      {aiSuggestion && (
        <div
          className="rounded-lg p-3 text-sm border"
          style={{
            background: "rgba(139,92,246,0.08)",
            borderColor: "rgba(139,92,246,0.2)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-violet-400 font-medium">AI Suggestion</span>
          </div>
          <p className="text-zinc-400">{aiSuggestion.reasoning}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full text-xs bg-violet-500/20 text-violet-300">
              {aiSuggestion.genre}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300">
              {aiSuggestion.mood}
            </span>
          </div>
        </div>
      )}

      {/* Genre chips */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
          Genre
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${
                  selectedGenre === g
                    ? "bg-violet-500/30 text-violet-200 border border-violet-500/50 shadow-[0_0_8px_rgba(139,92,246,0.2)]"
                    : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-300"
                }
              `}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Mood chips */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
          Mood
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMood(selectedMood === m ? null : m)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${
                  selectedMood === m
                    ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-[0_0_8px_rgba(34,197,94,0.2)]"
                    : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-300"
                }
              `}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Track list */}
      <div className="space-y-2">
        {isLoading && tracks.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-violet-500 rounded-full animate-pulse"
                  style={{
                    height: 16 + Math.random() * 16,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No tracks found. Try different filters.
          </div>
        ) : (
          tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isPlaying={playingTrackId === track.id}
              onTogglePlay={() => onTogglePlay(track)}
              onAdd={() => onAddTrack?.(track)}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {tracks.length > 0 && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg text-xs text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}

// ── Track Card ──────────────────────────────────────────
function TrackCard({
  track,
  isPlaying,
  onTogglePlay,
  onAdd,
}: {
  track: MusicTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
        ${
          isPlaying
            ? "bg-violet-500/[0.08] border-violet-500/30"
            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
        }
      `}
    >
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: isPlaying
            ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
            : "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
          boxShadow: isPlaying
            ? "0 0 12px rgba(34,197,94,0.3)"
            : "0 0 8px rgba(139,92,246,0.2)",
        }}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate font-medium">
          {track.title}
        </div>
        <div className="text-[11px] text-zinc-500 truncate">
          {track.artist} · {formatDuration(track.duration)}
        </div>
      </div>

      {/* Mini waveform */}
      <div className="hidden sm:block flex-shrink-0">
        <AudioWaveform
          audioUrl={track.previewUrl}
          width={80}
          height={28}
          color={isPlaying ? "#22c55e" : "#8B5CF6"}
          mini
        />
      </div>

      {/* Genre + Mood tags */}
      <div className="hidden md:flex gap-1 flex-shrink-0">
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-400">
          {track.genre}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400">
          {track.mood}
        </span>
      </div>

      {/* Add button */}
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/[0.06] hover:bg-violet-500/30 border border-white/[0.08] hover:border-violet-500/40 transition-all"
      >
        + Add
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// SILENCE REMOVAL TAB
// ═════════════════════════════════════════════════════════
function SilenceRemovalTab({
  audioUrl,
  silenceThreshold,
  setSilenceThreshold,
  minSilenceDuration,
  setMinSilenceDuration,
  silenceAction,
  setSilenceAction,
  speedMultiplier,
  setSpeedMultiplier,
  detectedSilences,
  totalSilenceDuration,
  showAfterPreview,
  setShowAfterPreview,
  onWaveformReady,
  onApply,
}: {
  audioUrl: string;
  silenceThreshold: number;
  setSilenceThreshold: (v: number) => void;
  minSilenceDuration: number;
  setMinSilenceDuration: (v: number) => void;
  silenceAction: "cut" | "speedup" | "none";
  setSilenceAction: (v: "cut" | "speedup" | "none") => void;
  speedMultiplier: number;
  setSpeedMultiplier: (v: number) => void;
  detectedSilences: SilenceSegment[];
  totalSilenceDuration: number;
  showAfterPreview: boolean;
  setShowAfterPreview: (v: boolean) => void;
  onWaveformReady: (peaks: Float32Array, duration: number) => void;
  onApply: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Waveform */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Audio Waveform
        </div>
        <AudioWaveform
          audioUrl={audioUrl}
          width={720}
          height={140}
          silenceRegions={showAfterPreview ? [] : detectedSilences}
          onWaveformReady={onWaveformReady}
          showZoom
        />
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Silence threshold */}
        <div
          className="rounded-lg p-3 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-2">
            <span className="text-xs text-zinc-400">Silence Threshold</span>
            <span className="text-xs text-violet-400 font-mono">
              {silenceThreshold}dB
            </span>
          </div>
          <input
            type="range"
            min={-60}
            max={-30}
            step={1}
            value={silenceThreshold}
            onChange={(e) => setSilenceThreshold(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span>-60dB (sensitive)</span>
            <span>-30dB (aggressive)</span>
          </div>
        </div>

        {/* Min silence duration */}
        <div
          className="rounded-lg p-3 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-2">
            <span className="text-xs text-zinc-400">Min Silence Duration</span>
            <span className="text-xs text-violet-400 font-mono">
              {minSilenceDuration.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.1}
            value={minSilenceDuration}
            onChange={(e) => setMinSilenceDuration(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span>0.3s (micro-pauses)</span>
            <span>2.0s (long pauses)</span>
          </div>
        </div>
      </div>

      {/* Action selection */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Silence Action
        </div>
        <div className="flex gap-2">
          {(
            [
              { id: "cut", label: "✂️ Cut (Remove)", desc: "Remove silent parts entirely" },
              { id: "speedup", label: "⚡ Speed Up", desc: `Fast-forward at ${speedMultiplier}×` },
              { id: "none", label: "📌 Keep", desc: "Leave silences as-is" },
            ] as const
          ).map((action) => (
            <button
              key={action.id}
              onClick={() => setSilenceAction(action.id)}
              className={`
                flex-1 p-3 rounded-lg border text-left transition-all duration-200
                ${
                  silenceAction === action.id
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }
              `}
            >
              <div className="text-sm text-white mb-0.5">{action.label}</div>
              <div className="text-[10px] text-zinc-500">{action.desc}</div>
            </button>
          ))}
        </div>

        {/* Speed multiplier slider (only for speedup) */}
        {silenceAction === "speedup" && (
          <div
            className="mt-3 rounded-lg p-3 border"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex justify-between mb-2">
              <span className="text-xs text-zinc-400">Speed Multiplier</span>
              <span className="text-xs text-violet-400 font-mono">
                {speedMultiplier}×
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={6}
              step={0.5}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-full accent-violet-500 h-1.5"
            />
          </div>
        )}
      </div>

      {/* Preview toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAfterPreview(!showAfterPreview)}
          className={`
            px-4 py-2 rounded-lg text-xs font-medium border transition-all
            ${
              showAfterPreview
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white"
            }
          `}
        >
          {showAfterPreview ? "Showing: After" : "Showing: Before"}
        </button>
        <span className="text-[10px] text-zinc-600">
          Toggle to preview result without silences
        </span>
      </div>

      {/* Stats + Apply */}
      <div
        className="flex items-center justify-between rounded-lg p-4 border"
        style={{
          background:
            "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(34,197,94,0.04) 100%)",
          borderColor: "rgba(139,92,246,0.15)",
        }}
      >
        <div>
          <div className="text-sm text-white font-medium">
            {detectedSilences.length} silence segments detected
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {totalSilenceDuration > 0
              ? `${totalSilenceDuration.toFixed(1)}s of silence found`
              : "Adjust sliders to detect silences"}
          </div>
        </div>
        <button
          onClick={onApply}
          disabled={detectedSilences.length === 0 || silenceAction === "none"}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
          style={{
            background:
              detectedSilences.length > 0 && silenceAction !== "none"
                ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                : "rgba(255,255,255,0.1)",
          }}
        >
          Apply {silenceAction === "cut" ? "Cut" : silenceAction === "speedup" ? "Speed Up" : ""}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// AUDIO DUCKING TAB
// ═════════════════════════════════════════════════════════
function AudioDuckingTab({
  audioUrl,
  speechRegions,
  duckSpeaking,
  setDuckSpeaking,
  duckSilent,
  setDuckSilent,
  fadeSpeed,
  setFadeSpeed,
}: {
  audioUrl: string;
  speechRegions: SilenceSegment[];
  duckSpeaking: number;
  setDuckSpeaking: (v: number) => void;
  duckSilent: number;
  setDuckSilent: (v: number) => void;
  fadeSpeed: "fast" | "medium" | "slow";
  setFadeSpeed: (v: "fast" | "medium" | "slow") => void;
}) {
  return (
    <div className="space-y-5">
      {/* Speech detection visualization */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Speech Detection
        </div>
        <AudioWaveform
          audioUrl={audioUrl}
          width={720}
          height={100}
          color="#22c55e"
          highlightColor="#8B5CF6"
          silenceRegions={speechRegions}
        />
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-green-500/40" />
            <span className="text-[10px] text-zinc-500">Speech (music ducks)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-violet-500/40" />
            <span className="text-[10px] text-zinc-500">Silence (music normal)</span>
          </div>
        </div>
      </div>

      {/* Ducking controls */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-lg p-4 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-3">
            <span className="text-xs text-zinc-400">Music When Speaking</span>
            <span className="text-xs text-violet-400 font-mono">{duckSpeaking}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={duckSpeaking}
            onChange={(e) => setDuckSpeaking(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          {/* Visual bar */}
          <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${duckSpeaking}%`,
                background: "linear-gradient(90deg, #8B5CF6, #6D28D9)",
              }}
            />
          </div>
        </div>

        <div
          className="rounded-lg p-4 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-3">
            <span className="text-xs text-zinc-400">Music When Silent</span>
            <span className="text-xs text-emerald-400 font-mono">{duckSilent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={duckSilent}
            onChange={(e) => setDuckSilent(Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5"
          />
          <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${duckSilent}%`,
                background: "linear-gradient(90deg, #22c55e, #16a34a)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Fade speed */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Fade Speed
        </div>
        <div className="flex gap-2">
          {(["fast", "medium", "slow"] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setFadeSpeed(speed)}
              className={`
                flex-1 py-2.5 rounded-lg text-xs font-medium border transition-all capitalize
                ${
                  fadeSpeed === speed
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              {speed === "fast" ? "⚡ Fast (100ms)" : speed === "medium" ? "🔄 Medium (300ms)" : "🐌 Slow (600ms)"}
            </button>
          ))}
        </div>
      </div>

      {/* Preview visualization */}
      <div
        className="rounded-lg p-4 border"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-medium">
          Ducking Preview
        </div>
        <div className="flex items-end gap-0.5 h-16">
          {Array.from({ length: 60 }, (_, i) => {
            const isSpeech = i % 10 < 6; // Simulated speech pattern
            const volume = isSpeech ? duckSpeaking : duckSilent;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-300"
                style={{
                  height: `${volume * 0.6 + 10}%`,
                  background: isSpeech
                    ? `rgba(139,92,246,${volume / 200 + 0.2})`
                    : `rgba(34,197,94,${volume / 200 + 0.2})`,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-zinc-600">🎤 Speaking</span>
          <span className="text-[10px] text-zinc-600">🔇 Silent</span>
          <span className="text-[10px] text-zinc-600">🎤 Speaking</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// AUDIO MIX TAB
// ═════════════════════════════════════════════════════════
function AudioMixTab({
  audioUrl,
  videoVolume,
  setVideoVolume,
  musicVolume,
  setMusicVolume,
  sfxVolume,
  setSfxVolume,
  masterVolume,
  setMasterVolume,
  fadeIn,
  setFadeIn,
  fadeOut,
  setFadeOut,
  videoMuted,
  setVideoMuted,
  musicMuted,
  setMusicMuted,
  sfxMuted,
  setSfxMuted,
}: {
  audioUrl: string;
  videoVolume: number;
  setVideoVolume: (v: number) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  sfxVolume: number;
  setSfxVolume: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  fadeIn: number;
  setFadeIn: (v: number) => void;
  fadeOut: number;
  setFadeOut: (v: number) => void;
  videoMuted: boolean;
  setVideoMuted: (v: boolean) => void;
  musicMuted: boolean;
  setMusicMuted: (v: boolean) => void;
  sfxMuted: boolean;
  setSfxMuted: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Volume channels */}
      <div className="space-y-3">
        <VolumeSlider
          label="Video Audio"
          icon="🎬"
          color="#8B5CF6"
          value={videoVolume}
          onChange={setVideoVolume}
          muted={videoMuted}
          onToggleMute={() => setVideoMuted(!videoMuted)}
        />
        <VolumeSlider
          label="Music"
          icon="🎵"
          color="#22c55e"
          value={musicVolume}
          onChange={setMusicVolume}
          muted={musicMuted}
          onToggleMute={() => setMusicMuted(!musicMuted)}
        />
        <VolumeSlider
          label="Sound Effects"
          icon="⚡"
          color="#FBBF24"
          value={sfxVolume}
          onChange={setSfxVolume}
          muted={sfxMuted}
          onToggleMute={() => setSfxMuted(!sfxMuted)}
        />

        {/* Separator */}
        <div className="border-t border-white/[0.06] my-2" />

        {/* Master */}
        <VolumeSlider
          label="Master"
          icon="🔊"
          color="#ef4444"
          value={masterVolume}
          onChange={setMasterVolume}
          muted={false}
          onToggleMute={() => {}}
          isMaster
        />
      </div>

      {/* Fade controls */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-lg p-3 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-2">
            <span className="text-xs text-zinc-400">Fade In Duration</span>
            <span className="text-xs text-violet-400 font-mono">{fadeIn.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={fadeIn}
            onChange={(e) => setFadeIn(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          {/* Fade curve preview */}
          <div className="mt-2 flex items-end gap-px h-6">
            {Array.from({ length: 20 }, (_, i) => {
              const t = i / 19;
              const fadeProgress = fadeIn > 0 ? Math.min(t / (fadeIn / 5), 1) : 1;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${fadeProgress * 100}%`,
                    background: `rgba(139,92,246,${0.3 + fadeProgress * 0.5})`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div
          className="rounded-lg p-3 border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex justify-between mb-2">
            <span className="text-xs text-zinc-400">Fade Out Duration</span>
            <span className="text-xs text-violet-400 font-mono">{fadeOut.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={fadeOut}
            onChange={(e) => setFadeOut(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          <div className="mt-2 flex items-end gap-px h-6">
            {Array.from({ length: 20 }, (_, i) => {
              const t = i / 19;
              const fadeProgress = fadeOut > 0 ? Math.max(1 - (t - (1 - fadeOut / 5)) / (fadeOut / 5), 0) : 1;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(fadeProgress, 0) * 100}%`,
                    background: `rgba(139,92,246,${0.3 + Math.max(fadeProgress, 0) * 0.5})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Audio waveform overlay */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Waveform Overlay
        </div>
        <div className="relative">
          <AudioWaveform
            audioUrl={audioUrl}
            width={720}
            height={80}
            color="rgba(139,92,246,0.6)"
          />
          <div className="absolute inset-0 opacity-50">
            <AudioWaveform
              audioUrl=""
              width={720}
              height={80}
              color="rgba(34,197,94,0.4)"
            />
          </div>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: "#8B5CF6" }} />
            <span className="text-[10px] text-zinc-500">Video Audio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: "#22c55e" }} />
            <span className="text-[10px] text-zinc-500">Music</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Volume Slider ───────────────────────────────────────
function VolumeSlider({
  label,
  icon,
  color,
  value,
  onChange,
  muted,
  onToggleMute,
  isMaster = false,
}: {
  label: string;
  icon: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  isMaster?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isMaster ? "bg-white/[0.04]" : "bg-white/[0.02]"
      }`}
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <span className="text-base w-6 text-center">{icon}</span>

      <button
        onClick={onToggleMute}
        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
          muted
            ? "text-red-400 bg-red-500/10"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      <span className="text-xs text-zinc-400 min-w-[80px]">{label}</span>

      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5"
          style={{ accentColor: color }}
        />
        {/* Volume bar background */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/[0.05] pointer-events-none -z-10" />
      </div>

      <span
        className="text-xs font-mono min-w-[36px] text-right"
        style={{ color: muted ? "#ef4444" : color }}
      >
        {muted ? "MUTE" : `${value}%`}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// SOUND EFFECTS TAB
// ═════════════════════════════════════════════════════════
function SoundEffectsTab({
  sfxCategory,
  setSfxCategory,
  sfxSearchQuery,
  setSfxSearchQuery,
  freesoundResults,
  isLoading,
  onSearch,
  onAddEffect,
}: {
  sfxCategory: string;
  setSfxCategory: (c: string) => void;
  sfxSearchQuery: string;
  setSfxSearchQuery: (q: string) => void;
  freesoundResults: SoundEffect[];
  isLoading: boolean;
  onSearch: () => void;
  onAddEffect: (sfx: SoundEffect) => void;
}) {
  const [playingSfxId, setPlayingSfxId] = useState<string | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentEffects = BUILTIN_SFX[sfxCategory] || [];

  const playSfx = useCallback(
    (sfx: SoundEffect) => {
      if (playingSfxId === sfx.id) {
        sfxAudioRef.current?.pause();
        setPlayingSfxId(null);
        return;
      }
      if (sfxAudioRef.current) sfxAudioRef.current.pause();
      if (sfx.previewUrl) {
        const audio = new Audio(sfx.previewUrl);
        audio.volume = 0.6;
        audio.play().catch(() => {});
        audio.onended = () => setPlayingSfxId(null);
        sfxAudioRef.current = audio;
      }
      setPlayingSfxId(sfx.id);
    },
    [playingSfxId]
  );

  return (
    <div className="space-y-5">
      {/* Category tabs */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Category
        </div>
        <div className="flex flex-wrap gap-2">
          {SFX_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSfxCategory(cat.name)}
              className={`
                px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200
                ${
                  sfxCategory === cat.name
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                }
              `}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Built-in effects grid */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          {sfxCategory} Effects
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {currentEffects.map((sfx) => (
            <div
              key={sfx.id}
              className={`
                flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                ${
                  playingSfxId === sfx.id
                    ? "bg-violet-500/10 border-violet-500/30"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                }
              `}
              onClick={() => playSfx(sfx)}
            >
              {/* Play icon */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                style={{
                  background:
                    playingSfxId === sfx.id
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : "rgba(139,92,246,0.2)",
                }}
              >
                {playingSfxId === sfx.id ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{sfx.name}</div>
                <div className="text-[10px] text-zinc-600">
                  {sfx.duration.toFixed(1)}s
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddEffect(sfx);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all opacity-0 group-hover:opacity-100"
                title="Add to timeline"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Freesound search */}
      <div
        className="border-t pt-4"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">
          Freesound.org Search
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={sfxSearchQuery}
            onChange={(e) => setSfxSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search sound effects..."
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-all"
          />
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
            }}
          >
            {isLoading ? "..." : "Search"}
          </button>
        </div>

        {/* Freesound results */}
        {freesoundResults.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {freesoundResults.map((sfx) => (
              <div
                key={sfx.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer group transition-all"
                onClick={() => playSfx(sfx)}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      playingSfxId === sfx.id
                        ? "linear-gradient(135deg, #22c55e, #16a34a)"
                        : "rgba(139,92,246,0.15)",
                  }}
                >
                  {playingSfxId === sfx.id ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{sfx.name}</div>
                </div>
                <span className="text-[10px] text-zinc-600">{sfx.duration}s</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEffect(sfx);
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
