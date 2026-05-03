"use client";

import {
  setCoverPhotoAction,
  deletePhotoAction,
} from "@/app/(app)/places/[id]/actions";
import { CoverPhotoButton } from "./CoverPhotoButton";
import { DeletePhotoButton } from "./DeletePhotoButton";

/**
 * Single photo tile in the place detail grid. This is the *manage*
 * surface — star (cover) and trash buttons. Lightbox-on-click lives
 * on the hero (`<PhotoHero>`), which already shows every photo as a
 * `<PhotoView>`; wrapping these tiles too would double-register each
 * image in the carousel and made "1/2" appear with a single photo.
 */
export function PhotoTile({
  photoId,
  url,
  isCover,
  canDelete,
}: {
  photoId: string;
  url: string;
  isCover: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <CoverPhotoButton
        photoId={photoId}
        isCover={isCover}
        action={setCoverPhotoAction}
      />
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deletePhotoAction} />
      )}
    </div>
  );
}
