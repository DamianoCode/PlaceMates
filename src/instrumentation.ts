/**
 * Next.js instrumentation hook. Runs once per server worker boot,
 * before the app starts handling requests. We use it to wire
 * Sentry per-runtime — Node and Edge have different SDKs.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Capture errors thrown during React Server Component rendering and
// Server Action execution. Without this, server-side errors only end
// up in console — Sentry never sees them. Sentry SDK >=9 renamed
// this export from onRequestError to captureRequestError.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
