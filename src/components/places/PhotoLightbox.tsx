"use client";

import { X } from "lucide-react";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

/**
 * The heavy half of PhotoGallery: react-photo-view + its stylesheet.
 * Split out so PhotoGallery can load it with next/dynamic only once a
 * photo is first opened — place pages no longer ship the slider up front.
 */
export default function PhotoLightbox({
  photos,
  visible,
  index,
  onClose,
  onIndexChange,
}: {
  photos: { id: string; url: string }[];
  visible: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  return (
    <PhotoSlider
      images={photos.map((p) => ({ src: p.url, key: p.id }))}
      visible={visible}
      onClose={onClose}
      index={index}
      onIndexChange={onIndexChange}
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
  );
}
