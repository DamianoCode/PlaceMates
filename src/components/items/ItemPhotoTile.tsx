"use client";

import { PhotoView } from "react-photo-view";
import {
  deleteItemPhotoAction,
  setCoverItemPhotoAction,
} from "@/app/(app)/places/[id]/item-actions";
import { CoverPhotoButton } from "@/components/places/CoverPhotoButton";
import { DeletePhotoButton } from "@/components/places/DeletePhotoButton";

/**
 * Single photo tile in the item detail grid. Same shape and shared
 * overlay buttons as the place `<PhotoTile>` — the only difference is
 * which server actions get bound. Cover toggle controls which photo
 * the item hero promotes; delete is uploader-only.
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
        action={setCoverItemPhotoAction}
      />
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deleteItemPhotoAction} />
      )}
    </div>
  );
}
