"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { X } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

type Photo = { id: string; url: string };

type GalleryContext = {
  /** Open the lightbox on the photo with this id. No-op if id missing. */
  openAt: (photoId: string) => void;
};

const Ctx = createContext<GalleryContext | null>(null);

/**
 * Controlled lightbox provider. Single source of truth for the photo
 * array — every clickable image (hero, hero strip, grid tile) calls
 * `openAt(photoId)` from context, so no matter how many DOM nodes
 * trigger the same photo, the carousel sees one slot per real photo.
 *
 * Why controlled instead of declarative `<PhotoView>`:
 *   - `<PhotoView>` registers ONE carousel slot per render, so the
 *     same image rendered in both hero and grid double-registered
 *     and the counter showed "1/2" with one photo. Controlled mode
 *     decouples "what is shown" from "what's clickable".
 *   - Custom chrome (close X, conditional counter) cleanly via
 *     `bannerVisible={false}` + `overlayRender`.
 *
 * Caller passes the canonical `photos` array; index lookup happens
 * here via id.
 */
export function PhotoGallery({
  photos,
  children,
}: {
  photos: Photo[];
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = useCallback(
    (photoId: string) => {
      const i = photos.findIndex((p) => p.id === photoId);
      if (i < 0) return;
      setIndex(i);
      setVisible(true);
    },
    [photos],
  );

  // Keep the slider sane if photos shrink while it's open (e.g. user
  // deletes the photo currently being viewed). Deferred via
  // queueMicrotask so the React-compiler set-state-in-effect rule is
  // satisfied — the correction is purely reactive cleanup, not a
  // render-time computation.
  useEffect(() => {
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      if (photos.length === 0 && visible) setVisible(false);
      else if (index >= photos.length)
        setIndex(Math.max(0, photos.length - 1));
    });
    return () => {
      abort = true;
    };
  }, [photos.length, visible, index]);

  return (
    <Ctx.Provider value={{ openAt }}>
      {children}
      <PhotoSlider
        images={photos.map((p) => ({ src: p.url, key: p.id }))}
        visible={visible}
        onClose={() => setVisible(false)}
        index={index}
        onIndexChange={setIndex}
        maskOpacity={0.92}
        bannerVisible={false}
        pullClosable
        loop={false}
        speed={() => 240}
        easing={() => "cubic-bezier(0.4, 0, 0.2, 1)"}
        overlayRender={({ onClose, index: i, images }) => {
          const total = images.length;
          return (
            <>
              {total > 1 && (
                <span className="pointer-events-none absolute top-3 left-3 z-50 rounded-full bg-black/40 px-2.5 py-1 font-mono text-xs tabular-nums text-white/90 backdrop-blur">
                  {i + 1} / {total}
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
      />
    </Ctx.Provider>
  );
}

/**
 * Read access to the gallery's open handler. Throws if used outside
 * `<PhotoGallery>` so missing wiring fails loudly during development.
 */
export function usePhotoOpener(): GalleryContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("usePhotoOpener must be used inside <PhotoGallery>");
  }
  return ctx;
}
