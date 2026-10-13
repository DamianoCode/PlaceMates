"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import dynamic from "next/dynamic";

// Loaded on first open only; see PhotoLightbox.
const PhotoLightbox = dynamic(() => import("./PhotoLightbox"), { ssr: false });

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
  // Flips once on the first open and stays true, so the lightbox chunk is
  // fetched lazily but stays mounted for its close animation.
  const [opened, setOpened] = useState(false);

  const openAt = useCallback(
    (photoId: string) => {
      const i = photos.findIndex((p) => p.id === photoId);
      if (i < 0) return;
      setIndex(i);
      setOpened(true);
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
      {opened && (
        <PhotoLightbox
          photos={photos}
          visible={visible}
          index={index}
          onClose={() => setVisible(false)}
          onIndexChange={setIndex}
        />
      )}
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
