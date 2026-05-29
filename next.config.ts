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
    // Client Router Cache. With the v15 default of 0s, every navigation
    // re-fetches the page's RSC payload from the server — so revisiting a
    // place you just viewed (e.g. back from an item, or hopping between
    // places) re-runs all ~13 DB reads each time. Caching the rendered
    // segment client-side makes those revisits instant. Mutations stay
    // correct: Server Actions + the existing revalidatePath calls purge
    // the cached entry, so the next visit after an edit is fresh.
    //   dynamic — pages rendered per-request (most of this app)
    //   static  — prefetched links / loading.tsx boundaries
    staleTimes: {
      dynamic: 30,
      static: 180,
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
