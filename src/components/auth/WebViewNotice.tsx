"use client";

import { useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { webViewLabel, type WebViewKind } from "@/lib/webview";

/**
 * Google's OAuth refuses `disallowed_useragent` from every in-app
 * WebView — it's a platform-level phishing guard with no opt-out on
 * the Cloud Console side. Users have two legitimate paths:
 *
 *   1. Open the page in a system browser (Safari / Chrome / etc.)
 *   2. Install PlaceMates as a PWA on the home screen; standalone
 *      mode reports a different UA and Google accepts it.
 *
 * This banner presents both, short and to the point.
 */
export function WebViewNotice({ kind }: { kind: Exclude<WebViewKind, null> }) {
  const [copied, setCopied] = useState(false);
  const href = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => "",
  );
  const label = webViewLabel(kind);

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in a few in-app browsers — URL is visible
      // in the code block above the button so users can long-press.
    }
  }

  function tryAutoOpen() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const ua = navigator.userAgent;

    if (/iPhone|iPad|iPod/.test(ua)) {
      window.location.href = `x-safari-${url}`;
      return;
    }
    if (/Android/.test(ua)) {
      const noScheme = url.replace(/^https?:\/\//, "");
      window.location.href =
        `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="alert"
      className="mb-5 space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={18}
          className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div className="space-y-1">
          <p className="font-semibold">
            Logowanie przez Google zablokowane w {label}
          </p>
          <p className="text-muted-foreground">
            Otwórz PlaceMates w przeglądarce (Safari / Chrome) albo
            zainstaluj jako aplikację na ekranie głównym.
          </p>
        </div>
      </div>

      {/* Copy + auto-open row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={tryAutoOpen}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          <ExternalLink size={14} />
          Otwórz w przeglądarce
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-amber-500/40 bg-background px-3 text-xs font-medium hover:bg-muted"
          aria-label="Skopiuj link"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Skopiowano" : "Kopiuj link"}
        </button>
      </div>

      {/* Fallback URL — long-press works when clipboard blocked. */}
      {href && (
        <code
          className="block overflow-hidden rounded bg-muted/60 px-2 py-1.5 text-[11px] break-all"
          aria-label="Adres strony"
        >
          {href}
        </code>
      )}

      {/* PWA install tip — the second legitimate path. */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-background/40 p-3 text-xs">
        <Smartphone
          size={14}
          className="mt-0.5 flex-shrink-0 text-muted-foreground"
        />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">
            Albo zainstaluj PlaceMates jako aplikację
          </span>{" "}
          — otwórz w Safari / Chrome i wybierz „Dodaj do ekranu głównego”.
          Logowanie Google w aplikacji działa bez zarzutu.
        </p>
      </div>
    </div>
  );
}
