"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { VoiceEnhancementPreset, VoiceEnhancementSettings } from "@/types/cineflow";

const ACCENT = "#8B5CF6";
const BORDER = "rgba(255,255,255,0.08)";

interface PresetConfig {
  id: VoiceEnhancementPreset;
  label: string;
  icon: string;
  description: string;
  warmth: number;
  clarity: number;
  deess: number;
  compress: number;
}

const PRESETS: PresetConfig[] = [
  {
    id: "podcast",
    label: "Podcast",
    icon: "🎙️",
    description: "Šiltas + aiškus + lengva kompresija",
    warmth: 60,
    clarity: 55,
    deess: 40,
    compress: 45,
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: "📺",
    description: "Presence boost + de-esser + vidutinė kompresija",
    warmth: 45,
    clarity: 70,
    deess: 55,
    compress: 60,
  },
  {
    id: "asmr",
    label: "ASMR",
    icon: "🌙",
    description: "Šiluma + stiprus de-esser + švelni kompresija",
    warmth: 75,
    clarity: 35,
    deess: 80,
    compress: 30,
  },
  {
    id: "broadcast",
    label: "Broadcast",
    icon: "📡",
    description: "Stipri kompresija + limiter + presence",
    warmth: 40,
    clarity: 65,
    deess: 50,
    compress: 85,
  },
];

// Maps 0-100 slider values to actual audio parameters
function mapSliderToParams(settings: VoiceEnhancementSettings) {
  return {
    // Warmth: low-mid boost at 250Hz
    warmthGain: (settings.warmth / 100) * 8 - 2, // -2 to +6 dB
    warmthQ: 0.7,

    // Clarity: presence boost at 3kHz
    clarityGain: (settings.clarity / 100) * 10 - 2, // -2 to +8 dB
    clarityQ: 1,

    // De-ess: cut at 6kHz
    deessGain: -(settings.deess / 100) * 12, // 0 to -12 dB
    deessQ: 2,

    // Compressor
    compThreshold: -10 - (settings.compress / 100) * 30, // -10 to -40 dB
    compRatio: 1 + (settings.compress / 100) * 11, // 1:1 to 12:1
    compAttack: 0.003,
    compRelease: 0.25,

    // Limiter
    limiterThreshold: -1,
    limiterRatio: 20,
  };
}

interface VoiceEnhancementProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function VoiceEnhancement({ videoRef }: VoiceEnhancementProps) {
  const [settings, setSettings] = useState<VoiceEnhancementSettings>({
    enabled: false,
    preset: "youtube",
    warmth: 45,
    clarity: 70,
    deess: 55,
    compress: 60,
  });

  const [comparing, setComparing] = useState(false); // before/after toggle

  // Audio chain refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const chainRef = useRef<{
    warmth: BiquadFilterNode;
    clarity: BiquadFilterNode;
    deess: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    limiter: DynamicsCompressorNode;
  } | null>(null);
  const isConnectedRef = useRef(false);

  // Create or update the audio chain
  const setupChain = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const params = mapSliderToParams(settings);

    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        console.error("[voice-enhancement] Failed to create AudioContext");
        return;
      }
    }

    const ctx = audioCtxRef.current;

    // Create source once
    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(video);
      } catch {
        // Source may already be connected from NoiseRemoval
        console.warn("[voice-enhancement] MediaElementSource already exists, skipping");
        return;
      }
    }

    if (!chainRef.current) {
      // Build new chain
      const warmth = ctx.createBiquadFilter();
      warmth.type = "peaking";
      warmth.frequency.value = 250;
      warmth.Q.value = params.warmthQ;

      const clarity = ctx.createBiquadFilter();
      clarity.type = "peaking";
      clarity.frequency.value = 3000;
      clarity.Q.value = params.clarityQ;

      const deess = ctx.createBiquadFilter();
      deess.type = "peaking";
      deess.frequency.value = 6000;
      deess.Q.value = params.deessQ;

      const compressor = ctx.createDynamicsCompressor();
      compressor.attack.value = params.compAttack;
      compressor.release.value = params.compRelease;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = params.limiterThreshold;
      limiter.ratio.value = params.limiterRatio;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;

      chainRef.current = { warmth, clarity, deess, compressor, limiter };
    }

    // Update chain params
    const chain = chainRef.current;
    chain.warmth.gain.value = params.warmthGain;
    chain.clarity.gain.value = params.clarityGain;
    chain.deess.gain.value = params.deessGain;
    chain.compressor.threshold.value = params.compThreshold;
    chain.compressor.ratio.value = params.compRatio;
    chain.compressor.attack.value = params.compAttack;
    chain.compressor.release.value = params.compRelease;
    chain.limiter.threshold.value = params.limiterThreshold;
    chain.limiter.ratio.value = params.limiterRatio;
  }, [videoRef, settings]);

  // Connect/disconnect chain based on enabled state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (settings.enabled && !comparing) {
      setupChain();
      const chain = chainRef.current;
      const source = sourceRef.current;
      const ctx = audioCtxRef.current;

      if (chain && source && ctx && !isConnectedRef.current) {
        try {
          source.disconnect();
          source.connect(chain.warmth);
          chain.warmth.connect(chain.clarity);
          chain.clarity.connect(chain.deess);
          chain.deess.connect(chain.compressor);
          chain.compressor.connect(chain.limiter);
          chain.limiter.connect(ctx.destination);
          isConnectedRef.current = true;
        } catch (e) {
          console.error("[voice-enhancement] Connect error:", e);
        }
      }
    } else {
      // Bypass: connect source directly
      const source = sourceRef.current;
      const ctx = audioCtxRef.current;
      const chain = chainRef.current;

      if (source && ctx && isConnectedRef.current) {
        try {
          if (chain) {
            chain.limiter.disconnect();
            chain.compressor.disconnect();
            chain.deess.disconnect();
            chain.clarity.disconnect();
            chain.warmth.disconnect();
          }
          source.disconnect();
          source.connect(ctx.destination);
          isConnectedRef.current = false;
        } catch (e) {
          console.error("[voice-enhancement] Disconnect error:", e);
        }
      }
    }
  }, [settings.enabled, comparing, setupChain, videoRef]);

  // Update params when sliders change
  useEffect(() => {
    if (settings.enabled && !comparing && chainRef.current) {
      setupChain();
    }
  }, [settings.warmth, settings.clarity, settings.deess, settings.compress, settings.enabled, comparing, setupChain]);

  const handlePresetSelect = useCallback((preset: PresetConfig) => {
    setSettings((prev) => ({
      ...prev,
      preset: preset.id,
      warmth: preset.warmth,
      clarity: preset.clarity,
      deess: preset.deess,
      compress: preset.compress,
    }));
  }, []);

  const handleSliderChange = useCallback((key: keyof Pick<VoiceEnhancementSettings, "warmth" | "clarity" | "deess" | "compress">, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const sliders: { key: keyof Pick<VoiceEnhancementSettings, "warmth" | "clarity" | "deess" | "compress">; label: string; icon: string }[] = [
    { key: "warmth", label: "Warmth", icon: "🔥" },
    { key: "clarity", label: "Clarity", icon: "💎" },
    { key: "deess", label: "De-ess", icon: "🐍" },
    { key: "compress", label: "Compress", icon: "📐" },
  ];

  return (
    <div style={{ padding: "16px" }}>
      {/* Header with ON/OFF */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎙️</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Voice Enhancement</h3>
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            border: "none",
            background: settings.enabled
              ? `linear-gradient(90deg, ${ACCENT}, #7C3AED)`
              : "rgba(255,255,255,0.1)",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              left: settings.enabled ? 24 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        </button>
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Web Audio API chain kuri pagerina balso kokybę real-time — de-esser, presence boost, warmth ir kompresija.
      </p>

      {/* Presets */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Preset
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              style={{
                padding: "10px 10px",
                borderRadius: 10,
                border: `1px solid ${settings.preset === preset.id ? ACCENT : BORDER}`,
                background: settings.preset === preset.id ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{preset.icon}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: settings.preset === preset.id ? "#fff" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {preset.label}
                </span>
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual sliders */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: "rgba(0,0,0,0.2)",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase" }}>
          Manual Controls
        </div>

        {sliders.map((slider) => (
          <div key={slider.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{slider.icon}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", width: 60 }}>{slider.label}</span>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type="range"
                min="0"
                max="100"
                value={settings[slider.key]}
                onChange={(e) => handleSliderChange(slider.key, Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: ACCENT,
                  height: 4,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "monospace",
                width: 28,
                textAlign: "right",
              }}
            >
              {settings[slider.key]}
            </span>
          </div>
        ))}
      </div>

      {/* Before/After toggle */}
      <button
        onClick={() => setComparing((prev) => !prev)}
        disabled={!settings.enabled}
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 10,
          border: `1px solid ${comparing ? "#f59e0b" : BORDER}`,
          background: comparing ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.02)",
          color: !settings.enabled
            ? "rgba(255,255,255,0.2)"
            : comparing
              ? "#f59e0b"
              : "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: 600,
          cursor: settings.enabled ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {comparing ? "🔊 Listening: BEFORE (original)" : "🔊 Before / After"}
      </button>

      {/* Status */}
      {settings.enabled && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            fontSize: 11,
            color: "rgba(34,197,94,0.8)",
            textAlign: "center",
          }}
        >
          ✅ Voice Enhancement aktyvus — {PRESETS.find((p) => p.id === settings.preset)?.label || "Custom"}
        </div>
      )}
    </div>
  );
}
