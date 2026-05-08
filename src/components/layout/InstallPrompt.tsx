"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * One-line "Zainstaluj na ekranie głównym" banner that surfaces
 * Chrome/Edge's `beforeinstallprompt` event (Android, desktop).
 * Hidden on iOS Safari — the API doesn't exist there; iOS users
 * install via the share sheet, and a banner shouting "install"
 * with no actionable button would be a dead-end.
 *
 * Dismiss is sticky for 30 days via localStorage so a casual
 * "not now" doesn't haunt the user every session.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pm.install-prompt.dismissed-at";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already dismissed recently → don't even subscribe.
    const dismissed = readDismissedAt();
    if (dismissed && Date.now() - dismissed < DISMISS_TTL_MS) return;

    function handler(e: Event) {
      // Block Chrome's mini-infobar; we own the surface.
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setShow(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide after install — the OS-native install dialog dispatches
  // `appinstalled`; we use that to clear the banner and remember
  // the prompt was satisfied.
  useEffect(() => {
    function onInstalled() {
      setShow(false);
      setEvt(null);
      writeDismissedAt(Date.now());
    }
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const accept = useCallback(async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setShow(false);
    setEvt(null);
    // Either accepted (will fire appinstalled) or dismissed —
    // mark dismissed regardless so the banner doesn't re-appear
    // on the next page nav.
    writeDismissedAt(Date.now());
  }, [evt]);

  const dismiss = useCallback(() => {
    setShow(false);
    writeDismissedAt(Date.now());
  }, []);

  if (!show || !evt) return null;

  return (
    <div
      role="dialog"
      aria-label="Zainstaluj aplikację"
      className="fixed inset-x-3 bottom-[calc(60px+env(safe-area-inset-bottom)+0.5rem)] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
      >
        <Download size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">
          Zainstaluj PlaceMates
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Otwieraj z ekranu głównego, bez paska adresu.
        </p>
      </div>
      <button
        type="button"
        onClick={accept}
        className="inline-flex h-9 flex-shrink-0 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Zainstaluj
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zamknij"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function readDismissedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(ts));
  } catch {
    // SafariPrivate / quota — silently ignore. Worst case banner
    // shows again next session, no harm.
  }
}
