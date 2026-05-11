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
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf5ec",
          color: "#5b3a24",
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
              color: "#8a6747",
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
              background: "#b8613a",
              color: "#faf5ec",
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
