import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  // TODO(pwa-offline): wire up @serwist/turbopack for offline shell +
  // runtime caching (docs: https://serwist.pages.dev/docs/next/turbo).
  // For MVP, manifest alone gives install prompt on Android and Add to
  // Home Screen on iOS; full offline cache is follow-up.
};

export default nextConfig;
