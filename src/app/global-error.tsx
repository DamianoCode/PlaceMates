"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * App Router's "last resort" error boundary — catches errors that
 * crashed even the root layout. Reports to Sentry and shows a
 * minimal recovery UI.
 *
 * Must declare its own <html>/<body> since the root layout already
 * unmounted by the time this renders.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl">
      {/* Renders outside ThemeProvider, so only the OS preference is
       *  available. Values mirror the globals.css tokens. */}
      <head>
        <style>{`
          :root { --e-bg: #fdf8f0; --e-ink: #221812; --e-muted: #6d6059; --e-accent: #bd592f; --e-accent-ink: #fdf8f0; color-scheme: light dark; }
          @media (prefers-color-scheme: dark) {
            :root { --e-bg: #16100c; --e-ink: #efeae2; --e-muted: #9e978f; --e-accent: #e9884d; --e-accent-ink: #16100c; }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--e-bg)",
          color: "var(--e-ink)",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 360, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>Coś poszło nie tak</h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--e-muted)",
              fontStyle: "italic",
            }}
          >
            Już wiem o tym i pracuję nad fixem. Spróbuj odświeżyć stronę.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              height: 44,
              padding: "0 20px",
              borderRadius: 999,
              background: "var(--e-accent)",
              color: "var(--e-accent-ink)",
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Odśwież
          </button>
        </main>
      </body>
    </html>
  );
}
