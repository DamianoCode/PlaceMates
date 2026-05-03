"use client";

import {
  deleteItemPhotoAction,
  setCoverItemPhotoAction,
} from "@/app/(app)/places/[id]/item-actions";
import { CoverPhotoButton } from "@/components/places/CoverPhotoButton";
import { DeletePhotoButton } from "@/components/places/DeletePhotoButton";
import { usePhotoOpener } from "@/components/places/PhotoGallery";

/**
 * Single photo tile in the item detail grid. Same shape and shared
 * overlay buttons as the place `<PhotoTile>` — clicking the image
 * opens the lightbox through the gallery context (no double-count
 * with the hero because the photo array upstream is the single
 * source of truth for the carousel).
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
  const { openAt } = usePhotoOpener();
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        onClick={() => openAt(photoId)}
        className="h-full w-full cursor-zoom-in object-cover"
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
