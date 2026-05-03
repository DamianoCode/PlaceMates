"use client";

import { X } from "lucide-react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

/**
 * Shared lightbox provider. Wraps any subtree where photos may be
 * `<PhotoView>`-tapped — clicks then open a smooth fullscreen viewer
 * with pinch-to-zoom and swipe between siblings.
 *
 * One PhotoProvider per logical gallery (per page is fine) — sibling
 * `<PhotoView>` elements inside the same provider share their swipe
 * carousel, so the user can flick from the hero into the gallery
 * thumbnails without re-tapping each one.
 *
 * Banner is replaced with a custom toolbar — the default one renders
 * a "1/1" counter even for single images and stacks zoom/rotate icons
 * we don't need (pinch + scroll-wheel already cover zoom). Our
 * toolbar is just the close X plus the counter when it's actually
 * meaningful (≥ 2 photos).
 */
export function PhotoGallery({ children }: { children: React.ReactNode }) {
  return (
    <PhotoProvider
      maskOpacity={0.92}
      // bannerVisible has to be on for toolbarRender to mount; we just
      // render only what we want inside it.
      bannerVisible
      pullClosable
      // Disable carousel looping. With one image the user could still
      // feel a horizontal rubber-band that hinted at "more" — `loop`
      // off keeps the gesture quiet.
      loop={false}
      // 240ms feels brisk on desktop and natural on phones — quick
      // enough that a casual tap doesn't feel like a commitment.
      speed={() => 240}
      easing={() => "cubic-bezier(0.4, 0, 0.2, 1)"}
      toolbarRender={({ onClose, index, images }) => {
        const total = images.length;
        return (
          <div className="flex items-center gap-3">
            {total > 1 && (
              <span className="font-mono text-xs tabular-nums text-white/80">
                {index + 1} / {total}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              title="Zamknij"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        );
      }}
    >
      {children}
    </PhotoProvider>
  );
}
