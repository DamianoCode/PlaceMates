"use client";

import { PhotoView } from "react-photo-view";
import {
  setCoverPhotoAction,
  deletePhotoAction,
} from "@/app/(app)/places/[id]/actions";
import { CoverPhotoButton } from "./CoverPhotoButton";
import { DeletePhotoButton } from "./DeletePhotoButton";

/**
 * Single photo tile in the place detail grid. Visual frame + img +
 * shared cover/delete overlay buttons. The buttons are the same
 * components item tiles use; only the bound server actions differ.
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
      <PhotoView src={url}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full cursor-zoom-in object-cover"
        />
      </PhotoView>
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
