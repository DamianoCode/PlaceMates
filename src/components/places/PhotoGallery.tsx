"use client";

import { X } from "lucide-react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

/**
 * Shared lightbox provider. Wraps any subtree where photos may be
 * `<PhotoView>`-tapped — clicks open a smooth fullscreen viewer with
 * pinch-to-zoom and swipe between siblings.
 *
 * One PhotoProvider per logical gallery (per page is fine) — sibling
 * `<PhotoView>` elements inside the same provider share their swipe
 * carousel.
 *
 * Custom chrome:
 *   - Default banner is off — its counter and zoom/rotate buttons
 *     don't fit our look (and we got duplicate close icons when the
 *     library treated `toolbarRender` as additive rather than a
 *     replacement).
 *   - `overlayRender` draws our own close X (top-right) and a tiny
 *     "n / total" counter top-left, only when there are 2+ photos.
 *   - `loop={false}` quiets the horizontal rubber-band when there's
 *     nothing to navigate to.
 */
export function PhotoGallery({ children }: { children: React.ReactNode }) {
  return (
    <PhotoProvider
      maskOpacity={0.92}
      bannerVisible={false}
      pullClosable
      loop={false}
      speed={() => 240}
      easing={() => "cubic-bezier(0.4, 0, 0.2, 1)"}
      overlayRender={({ onClose, index, images }) => {
        const total = images.length;
        return (
          <>
            {total > 1 && (
              <span className="pointer-events-none absolute top-3 left-3 z-50 rounded-full bg-black/40 px-2.5 py-1 font-mono text-xs tabular-nums text-white/90 backdrop-blur">
                {index + 1} / {total}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              title="Zamknij"
              className="absolute top-3 right-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </>
        );
      }}
    >
      {children}
    </PhotoProvider>
  );
}
