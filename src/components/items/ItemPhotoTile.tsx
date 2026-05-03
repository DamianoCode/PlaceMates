"use client";

import {
  deleteItemPhotoAction,
  setCoverItemPhotoAction,
} from "@/app/(app)/places/[id]/item-actions";
import { CoverPhotoButton } from "@/components/places/CoverPhotoButton";
import { DeletePhotoButton } from "@/components/places/DeletePhotoButton";

/**
 * Single photo tile in the item detail grid. Manage-surface only:
 * cover toggle + uploader delete. Lightbox-on-click is handled by
 * the hero (`<PhotoHero>`) which already registers every photo with
 * the carousel; wrapping these tiles too would double-count each
 * image (and made "1/2" appear with a single photo).
 */
export function ItemPhotoTile({
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
        action={setCoverItemPhotoAction}
      />
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deleteItemPhotoAction} />
      )}
    </div>
  );
}
