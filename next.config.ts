import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  // Server Actions default to a 1 MB body limit, which silently
  // blocked any modern phone photo (3-12 MB raw). Client-side
  // compression in the upload forms brings uploads well under 1 MB
  // in practice; this 10 MB ceiling is a defensive fallback for
  // edge cases (camera RAW, very tall panoramas) so the user never
  // sees the opaque "Body exceeded limit" Next error.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // TODO(pwa-offline): wire up @serwist/turbopack for offline shell +
  // runtime caching (docs: https://serwist.pages.dev/docs/next/turbo).
  // For MVP, manifest alone gives install prompt on Android and Add to
  // Home Screen on iOS; full offline cache is follow-up.
};

export default nextConfig;
