"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPhotoAction } from "@/app/(app)/places/[id]/actions";

type State = { error: string } | { ok: true } | null;

export function PhotoUploadForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(addPhotoAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const error = state && "error" in state ? state.error : null;
  const saved = state && "ok" in state && state.ok;

  function onFileChange(file: File | null) {
    if (!file) {
      setPreview(null);
      setDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    const img = new Image();
    img.onload = () => {
      setDims({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="width" value={dims?.width ?? 0} />
      <input type="hidden" name="height" value={dims?.height ?? 0} />
      <Input
        type="file"
        name="photo"
        accept="image/*"
        required
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Podgląd"
          className="max-h-48 rounded-md object-cover"
        />
      )}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Zdjęcie dodane.</p> : null}
      <Button type="submit" disabled={pending || !dims}>
        {pending ? "Wysyłam…" : "Dodaj zdjęcie"}
      </Button>
    </form>
  );
}
