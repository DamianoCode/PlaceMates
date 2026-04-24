"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { webViewLabel, type WebViewKind } from "@/lib/webview";

/**
 * Shown on login / register when the page is loaded inside a WebView
 * where Google OAuth refuses (403 disallowed_useragent).
 *
 * Approach — layered, bulletproof first, convenience second:
 *   1. Banner copy points the user at the magic-link form below
 *      (always works regardless of platform / app).
 *   2. Collapsible details show step-by-step instructions for the
 *      specific app, plus a "copy link" button. This path is
 *      universal — every mobile OS has some menu that opens the
 *      current page in a real browser.
 *   3. An optional "try auto-open" button tries a platform-appropriate
 *      URL scheme. It's presented as best-effort because the result
 *      varies by app / version — instructions above handle the rest.
 */
export function WebViewNotice({ kind }: { kind: Exclude<WebViewKind, null> }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  // Read window.location.href without triggering the React 19
  // set-state-in-effect rule. The subscribe function is a no-op
  // because the URL doesn't change without a full navigation.
  const href = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => "",
  );
  const label = webViewLabel(kind);
  const steps = INSTRUCTIONS[kind] ?? INSTRUCTIONS.default;

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (happens in a few in-app browsers) — user
      // can still long-press the URL shown in the code block.
    }
  }

  function tryAutoOpen() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const ua = navigator.userAgent;

    // iOS: the x-safari-https scheme is honoured by most iOS WebViews.
    if (/iPhone|iPad|iPod/.test(ua)) {
      window.location.href = `x-safari-${url}`;
      return;
    }

    // Android: an Intent URI with the https scheme asks Android to
    // resolve the default browser. Falls through silently if the
    // current WebView doesn't act on it.
    if (/Android/.test(ua)) {
      const noScheme = url.replace(/^https?:\/\//, "");
      window.location.href =
        `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
      return;
    }

    // Anything else (desktop WebView embeds etc): open in a new tab;
    // often works, occasionally opens another in-app tab.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="alert"
      className="mb-5 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={18}
          className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div className="space-y-1">
          <p className="font-semibold">Zaloguj się przez email poniżej</p>
          <p className="text-muted-foreground">
            Google blokuje logowanie w przeglądarce {label}. Link, który
            przyjdzie na maila, otworzy się w normalnej przeglądarce — działa
            w każdej aplikacji.
          </p>
        </div>
      </div>

      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-lg border border-amber-500/30 bg-background/50"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium">
          <span>Albo otwórz tę stronę w systemowej przeglądarce</span>
          <ChevronDown
            size={14}
            className="transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="space-y-3 border-t border-amber-500/20 px-3 py-3">
          {steps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Lub skopiuj link i wklej do przeglądarki
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-[11px]">
                {href}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-amber-500/40 bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Skopiowano" : "Kopiuj"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={tryAutoOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-600 px-3.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            <ExternalLink size={14} />
            Spróbuj otworzyć automatycznie
          </button>
        </div>
      </details>
    </div>
  );
}

// Step-by-step instructions per app. Kept short and action-focused.
// iOS / Android differences folded together where the menu is similar.
const INSTRUCTIONS: Record<string, string[]> = {
  messenger: [
    "Dotknij ikony ⋯ (albo „Więcej”) w prawym górnym rogu",
    "Wybierz „Otwórz w Safari” (iPhone) lub „Otwórz w przeglądarce” (Android)",
  ],
  facebook: [
    "Dotknij ⋯ w prawym górnym rogu pod postem",
    "Wybierz „Otwórz w przeglądarce” albo „Otwórz w Safari”",
  ],
  instagram: [
    "Dotknij ⋯ obok paska adresu strony",
    "Wybierz „Otwórz w przeglądarce” albo „Otwórz w Safari”",
  ],
  linkedin: [
    "Dotknij ⋯ w prawym górnym rogu okna",
    "Wybierz „Otwórz w przeglądarce”",
  ],
  tiktok: [
    "Dotknij ikony udostępniania (po prawej)",
    "Wybierz „Kopiuj link”, wklej w Safari / Chrome",
  ],
  twitter: [
    "Dotknij ⋯ pod tweetem z linkiem",
    "Wybierz „Otwórz w przeglądarce”",
  ],
  line: [
    "Dotknij ikony ⚙ lub ⋯",
    "Wybierz „Otwórz w innej przeglądarce”",
  ],
  wechat: [
    "Dotknij ⋯ w prawym górnym rogu",
    "Wybierz „Otwórz w przeglądarce”",
  ],
  "ios-webview": [
    "Dotknij ikony udostępniania lub menu (⋯) w bieżącej aplikacji",
    "Wybierz „Otwórz w Safari”",
  ],
  "android-webview": [
    "Dotknij ⋮ w bieżącej aplikacji",
    "Wybierz „Otwórz w Chrome” albo „Otwórz w przeglądarce”",
  ],
  default: [
    "Znajdź menu aplikacji (najczęściej ⋯ lub ⋮ w rogu)",
    "Wybierz „Otwórz w przeglądarce” / „Open in browser”",
  ],
};
