import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
};

// withSentryConfig uploads source maps to Sentry on production
// builds so stack traces in the dashboard reference real source
// locations. Soft-fails if SENTRY_AUTH_TOKEN / SENTRY_ORG /
// SENTRY_PROJECT aren't set — local builds without those keys
// just skip the upload step.
export default withSentryConfig(nextConfig, {
  // Vercel deploy gets these from env vars set in the dashboard.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Hide source maps from production bundle (still uploaded to
  // Sentry for symbolicating, just not served to clients).
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Quiet build output unless something fails.
  silent: !process.env.CI,

  // Tunnel Sentry events through our domain to dodge tracker-
  // blockers. /monitoring is a Vercel-friendly path that doesn't
  // collide with any of our routes.
  tunnelRoute: "/monitoring",

  // Disable telemetry the SDK sends about its own build steps.
  telemetry: false,
});
