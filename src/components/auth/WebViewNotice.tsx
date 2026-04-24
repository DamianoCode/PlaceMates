"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink } from "lucide-react";
import { webViewLabel, type WebViewKind } from "@/lib/webview";

/**
 * Shown on login / register when the page is loaded inside a WebView
 * (Messenger, Instagram, TikTok, etc.). Google's OAuth refuses with
 * 403 disallowed_useragent in those contexts — instead of letting
 * users bang their heads, we:
 *
 *  1. Tell them what's going on in plain Polish.
 *  2. Offer a "Otwórz w Safari" button that tries the x-safari-https
 *     URL scheme (works from most iOS in-app browsers).
 *  3. Offer a "Skopiuj link" button as a bulletproof fallback.
 *
 * The magic-link form below this banner is the real workaround —
 * they click a link in their Mail app and land in real Safari, which
 * Google is happy to authenticate.
 */
export function WebViewNotice({ kind }: { kind: Exclude<WebViewKind, null> }) {
  const [copied, setCopied] = useState(false);
  const label = webViewLabel(kind);

  async function openInSafari() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    // iOS-specific scheme that most apps respect; elsewhere it's a no-op.
    window.location.href = `x-safari-${url}`;
  }

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — user can still long-press the URL bar
    }
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
          <p className="font-semibold">Otwórz w Safari, żeby się zalogować</p>
          <p className="text-muted-foreground">
            Strona otwarła się w wewnętrznej przeglądarce {label}. Google
            blokuje logowanie w takich przeglądarkach. Użyj maila (niżej)
            albo otwórz tę stronę w Safari.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openInSafari}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-600 px-3.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          <ExternalLink size={14} />
          Otwórz w Safari
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-500/40 bg-background px-3.5 text-xs font-medium hover:bg-muted"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Skopiowano" : "Skopiuj link"}
        </button>
      </div>
    </div>
  );
}
