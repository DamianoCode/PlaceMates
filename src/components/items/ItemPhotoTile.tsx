"use client";

import { deleteItemPhotoAction } from "@/app/(app)/places/[id]/item-actions";
import { DeletePhotoButton } from "@/components/places/DeletePhotoButton";

/**
 * Single photo tile in the item detail grid. Mirrors the place
 * `<PhotoTile>` shape but skips the "set as cover" button — items
 * don't surface a cover photo anywhere (no list-card with a
 * thumbnail), so the affordance would be meaningless. Reuses the
 * shared `<DeletePhotoButton>` so future fixes to the delete UX
 * happen in one place.
 */
export function ItemPhotoTile({
  photoId,
  url,
  canDelete,
}: {
  photoId: string;
  url: string;
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
      {canDelete && (
        <DeletePhotoButton photoId={photoId} action={deleteItemPhotoAction} />
      )}
    </div>
  );
}
