"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount. Lives in (app)/layout
 * so it's only active inside the authenticated experience — no
 * point caching the login screen aggressively.
 *
 * Failure modes are silently swallowed: the app works fine
 * without the SW, and a registration error is the kind of
 * thing the user can't do anything about.
 *
 * Updates: scope='/' is the default. We re-register every page
 * load which checks for a new sw.js byte-for-byte; if changed,
 * the browser installs it in the background and activates on
 * the next navigation (we use `self.skipWaiting()` so it doesn't
 * wait for tab close).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production. In dev, Next.js HMR + an active
    // SW caching old bundles is a recipe for "why isn't my edit
    // showing" rage. Use chrome://inspect or `next dev
    // --experimental-https` if you need to test offline locally.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* swallow */
      });

    // Replay queued mutations whenever the tab regains network —
    // belt-and-suspenders for browsers without Background Sync API
    // (Safari, Firefox in private mode). The SW still listens for
    // the actual `sync` event when supported.
    function onOnline() {
      navigator.serviceWorker.controller?.postMessage({
        type: "pm-replay-now",
      });
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
