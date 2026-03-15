import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  // Note: COOP/COEP headers for FFmpeg WASM SharedArrayBuffer
  // are applied dynamically in the export component only,
  // NOT globally — global COEP breaks blob URL video playback.
};

export default nextConfig;
