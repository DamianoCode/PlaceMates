"use client";

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
 */
export function PhotoGallery({ children }: { children: React.ReactNode }) {
  return (
    <PhotoProvider
      maskOpacity={0.92}
      bannerVisible={false}
      pullClosable
      // 240ms feels brisk on desktop and natural on phones — quick
      // enough that a casual tap doesn't feel like a commitment.
      speed={() => 240}
      easing={() => "cubic-bezier(0.4, 0, 0.2, 1)"}
    >
      {children}
    </PhotoProvider>
  );
}
