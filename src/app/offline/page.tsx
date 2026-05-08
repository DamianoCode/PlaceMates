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
 */
export const metadata = {
  title: "Offline — PlaceMates",
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf5ec",
        color: "#5b3a24",
        padding: 24,
      }}
    >
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
            background:
              "radial-gradient(circle at 30% 30%, rgba(184,97,58,0.18), rgba(184,97,58,0.04) 70%)",
            color: "#b8613a",
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
              color: "#8a6747",
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
            background: "#b8613a",
            color: "#faf5ec",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(184,97,58,0.3)",
          }}
        >
          <RefreshCw size={16} />
          Spróbuj ponownie
        </Link>
      </div>
    </main>
  );
}
