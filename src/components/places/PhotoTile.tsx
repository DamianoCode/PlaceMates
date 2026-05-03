"use client";

import {
  setCoverPhotoAction,
  deletePhotoAction,
} from "@/app/(app)/places/[id]/actions";
import { CoverPhotoButton } from "./CoverPhotoButton";
import { DeletePhotoButton } from "./DeletePhotoButton";
import { usePhotoOpener } from "./PhotoGallery";

/**
 * Single photo tile in the place detail grid. Visual frame + img +
 * shared cover/delete overlay buttons. Clicking the image (anywhere
 * outside the floating buttons) opens the lightbox via the gallery
 * context — the carousel is single-source-of-truth so the same photo
 * shown in both hero and grid registers exactly once.
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
        action={setCoverPhotoAction}
      />
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deletePhotoAction} />
      )}
    </div>
  );
}
