"use client";

import Image from "next/image";
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
      <button
        type="button"
        onClick={() => openAt(photoId)}
        aria-label="Otwórz zdjęcie"
        className="relative block h-full w-full cursor-zoom-in"
      >
        {/* Grid is 3 columns inside the max-w-2xl content column. */}
        <Image
          src={url}
          alt=""
          fill
          sizes="(max-width: 672px) 33vw, 224px"
          className="object-cover"
        />
      </button>
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
