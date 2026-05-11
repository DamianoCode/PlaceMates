import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry init. Next.js 16+ picks up
 * `instrumentation-client.ts` automatically — runs once in the
 * browser before app code.
 *
 * Soft-fail when DSN missing (local dev / forks without Sentry
 * account). Replay disabled by default — too much volume + privacy
 * concerns for a place-tracking app where users share addresses.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.NODE_ENV,
    // Don't send PII by default — addresses are PII-adjacent in
    // this app. Errors still get full stack + breadcrumbs.
    sendDefaultPii: false,
  });
}

// Capture client-side navigation errors. Exported for the
// router (App Router uses this hook in <Link/> click handler.)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
