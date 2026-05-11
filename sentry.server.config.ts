import * as Sentry from "@sentry/nextjs";

/**
 * Sentry config for the Node runtime (Server Components, Server
 * Actions, API routes). Loaded by `src/instrumentation.ts` once per
 * server worker boot.
 *
 * Soft-fail when SENTRY_DSN is unset — local dev without DSN keeps
 * the app working, just nothing reported. Same posture as VAPID
 * keys in the push pipeline.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Tracing: 0.1 = 10% of requests. Bump in production when we
    // need more samples to debug a specific issue.
    tracesSampleRate: 0.1,
    // Debug only in local dev. CI / prod stays quiet.
    debug: false,
    environment: process.env.NODE_ENV,
    // Don't send breadcrumbs from console.log on dev — gets noisy.
    // Errors and warnings still go through.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== "Console"),
  });
}
