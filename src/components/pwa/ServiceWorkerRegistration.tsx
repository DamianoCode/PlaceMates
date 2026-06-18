"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Service worker lifecycle owner. Lives in (app)/layout so it's only
 * active inside the authenticated experience.
 *
 * Three jobs:
 *   1) Dev self-heal — a SW left over from an earlier prod build on the
 *      same origin serves /_next/static cache-first, so it keeps feeding
 *      stale JS chunks to `next dev` (→ hydration mismatch that survives
 *      deleting .next and hard reloads). In dev we actively unregister it
 *      and drop its caches instead of silently leaving it in place.
 *   2) Registration — prod only, with a per-deploy `?v=` so each release
 *      gets its own cache generation (see next.config NEXT_PUBLIC_SW_VERSION).
 *   3) Controlled updates — the SW no longer skipWaiting()s itself. When
 *      an update is waiting we prompt the user; accepting sends
 *      `pm-skip-waiting` and reloads once the new worker takes control.
 *      This avoids swapping versioned assets under a running page.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Kill any leftover SW + its caches so dev is self-healing.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((k) => k.startsWith("pm-"))
                .map((k) => caches.delete(k)),
            ),
          )
          .catch(() => {});
      }
      return;
    }

    const version = process.env.NEXT_PUBLIC_SW_VERSION ?? "v1";

    // Reload only after the user opted into the update (not on the
    // first-ever install, where controllerchange also fires).
    let updateAccepted = false;
    let reloading = false;
    function onControllerChange() {
      if (!updateAccepted || reloading) return;
      reloading = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    function promptUpdate(worker: ServiceWorker) {
      toast("Dostępna nowa wersja", {
        description: "Odśwież, aby załadować najnowszą wersję aplikacji.",
        duration: Infinity,
        action: {
          label: "Odśwież",
          onClick: () => {
            updateAccepted = true;
            worker.postMessage({ type: "pm-skip-waiting" });
          },
        },
      });
    }

    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/" })
      .then((registration) => {
        // An update downloaded on a previous visit is already waiting.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `installed` + an existing controller means this is an
            // update (not the first install) — safe to prompt.
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        /* swallow — app works fine without the SW */
      });

    // Replay queued mutations whenever the tab regains network —
    // belt-and-suspenders for browsers without Background Sync API
    // (Safari, Firefox in private mode). The SW still listens for the
    // actual `sync` event when supported.
    function onOnline() {
      navigator.serviceWorker.controller?.postMessage({
        type: "pm-replay-now",
      });
    }
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
