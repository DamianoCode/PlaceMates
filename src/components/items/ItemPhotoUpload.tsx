"use client";

import { toast } from "sonner";
import { addItemPhotoAction } from "@/app/(app)/places/[id]/item-actions";
import { PhotoPicker } from "@/components/places/PhotoPicker";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";

/**
 * Photo upload for a place-item. Thin wrapper around `usePhotoUpload`
 * + `<PhotoPicker>` — same shape as `PhotoUploadForm`, only the action
 * and hidden input id differ.
 */
export function ItemPhotoUpload({ itemId }: { itemId: string }) {
  const upload = usePhotoUpload(addItemPhotoAction, {
    onSuccess: () => toast.success("Zdjęcie dodane."),
  });
  return (
    <PhotoPicker upload={upload}>
      <input type="hidden" name="itemId" value={itemId} />
    </PhotoPicker>
  );
}
