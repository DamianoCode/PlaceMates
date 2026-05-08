"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

/**
 * Tiny banner that surfaces "offline" so the user understands why
 * cards are stale or actions are queueing. Fixed near the bottom,
 * above BottomNav, hidden when online.
 *
 * `navigator.onLine` is a hint, not a truth — it just reflects the
 * OS network state, not actual reachability. Good enough for the
 * "we're definitely offline, expect degraded behaviour" cue; the
 * real fallbacks happen in fetch handlers / write queue.
 */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let abort = false;
    // Initial sync deferred to satisfy react-compiler's
    // set-state-in-effect rule. The default `true` covers the
    // SSR/first-paint window where navigator isn't readable.
    queueMicrotask(() => {
      if (!abort) setOnline(navigator.onLine);
    });
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      abort = true;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(60px+env(safe-area-inset-bottom)+0.5rem)] z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-amber-500/40 bg-amber-50/95 px-4 py-2 text-xs font-medium text-amber-900 shadow-lg backdrop-blur dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200 sm:bottom-4"
    >
      <CloudOff size={14} aria-hidden />
      <span>Brak sieci — działasz na cache, zmiany dolecą później</span>
    </div>
  );
}
