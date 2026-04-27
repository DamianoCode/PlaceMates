"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Root-level error boundary. Next.js renders this when an RSC throws
 * anywhere under `app/`. We deliberately keep it dependency-free so a
 * broken module elsewhere can't take this fallback down with it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in client console; production logs pick this up via Vercel.
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <AlertTriangle size={28} />
      </span>
      <h1 className="font-display text-2xl">Coś poszło nie tak.</h1>
      <p className="text-sm text-muted-foreground">
        Wewnętrzny błąd PlaceMates. Spróbuj odświeżyć — jeśli wraca, wróć
        do mapy i daj znać.
      </p>
      {error.digest ? (
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/70">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw size={14} /> Spróbuj ponownie
        </button>
        <Link
          href="/map"
          className="inline-flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Wróć na mapę
        </Link>
      </div>
    </main>
  );
}
