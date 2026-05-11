import * as Sentry from "@sentry/nextjs";

/**
 * Sentry config for the Edge runtime (middleware, edge routes).
 * We use the proxy in middleware — any errors there land here.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.NODE_ENV,
  });
}
