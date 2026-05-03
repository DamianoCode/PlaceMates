"use client";

import { toast } from "sonner";
import { addPhotoAction } from "@/app/(app)/places/[id]/actions";
import { PhotoPicker } from "@/components/places/PhotoPicker";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";

/**
 * Photo upload for a place. Thin wrapper around `usePhotoUpload` +
 * `<PhotoPicker>` — all the picking, compression, preview and submit
 * orchestration lives in the hook so this file just binds the action
 * and the placeId hidden input.
 */
export function PhotoUploadForm({ placeId }: { placeId: string }) {
  const upload = usePhotoUpload(addPhotoAction, {
    onSuccess: () => toast.success("Zdjęcie dodane."),
  });
  return (
    <PhotoPicker upload={upload}>
      <input type="hidden" name="placeId" value={placeId} />
    </PhotoPicker>
  );
}
