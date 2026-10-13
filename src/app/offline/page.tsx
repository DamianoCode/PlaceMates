import Link from "next/link";
import { Compass, RefreshCw } from "lucide-react";

/**
 * Last-resort fallback when navigation fails AND we don't have the
 * specific page cached. Cached pages render normally — this only
 * shows for routes the user has never visited.
 *
 * Inline styles instead of Tailwind classes — the user might land
 * here mid-loading where Tailwind's CSS isn't yet hot in cache.
 * Keeps the rendering deterministic regardless of cache state.
 *
 * Colours come from a tiny inline <style> of custom properties so the
 * page follows the theme too: the `.dark` class next-themes puts on
 * <html>, or the OS preference when no explicit `.light` is set.
 * Values mirror the globals.css tokens (paper / espresso / terracotta).
 */
export const metadata = {
  title: "Offline — PlaceMates",
};

const THEME_CSS = `
.pm-offline {
  --o-bg: #fdf8f0;
  --o-ink: #221812;
  --o-muted: #6d6059;
  --o-accent: #b35025;
  --o-accent-ink: #fdf8f0;
  --o-halo: rgba(179, 80, 37, 0.16);
}
.dark .pm-offline {
  --o-bg: #16100c;
  --o-ink: #efeae2;
  --o-muted: #9e978f;
  --o-accent: #e9884d;
  --o-accent-ink: #16100c;
  --o-halo: rgba(233, 136, 77, 0.16);
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .pm-offline {
    --o-bg: #16100c;
    --o-ink: #efeae2;
    --o-muted: #9e978f;
    --o-accent: #e9884d;
    --o-accent-ink: #16100c;
    --o-halo: rgba(233, 136, 77, 0.16);
  }
}
`;

export default function OfflinePage() {
  return (
    <main
      className="pm-offline"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--o-bg)",
        color: "var(--o-ink)",
        padding: 24,
      }}
    >
      <style>{THEME_CSS}</style>
      <div
        style={{
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "var(--o-halo)",
            color: "var(--o-accent)",
          }}
        >
          <Compass size={44} strokeWidth={1.5} />
        </span>

        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              lineHeight: 1.15,
              fontWeight: 600,
            }}
          >
            Brak sieci
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--o-muted)",
              fontStyle: "italic",
            }}
          >
            Nie mamy w pamięci tej strony. Wróć do ostatnio odwiedzonego
            miejsca albo poczekaj aż wróci sygnał.
          </p>
        </div>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 20px",
            borderRadius: 999,
            background: "var(--o-accent)",
            color: "var(--o-accent-ink)",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <RefreshCw size={16} aria-hidden />
          Spróbuj ponownie
        </Link>
      </div>
    </main>
  );
}
