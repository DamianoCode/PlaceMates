"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addItemPhotoAction,
  type AddItemPhotoState,
} from "@/app/(app)/places/[id]/item-actions";

/** Same two-source pattern as place photos: camera or gallery. */
export function ItemPhotoUpload({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<AddItemPhotoState, FormData>(
    addItemPhotoAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const error = state && "error" in state ? state.error : null;
  const saved = !!(state && "ok" in state && state.ok === true);

  const prevSaved = useRef(false);
  useEffect(() => {
    if (saved && !prevSaved.current) {
      clear();
      toast.success("Zdjęcie dodane.");
    }
    prevSaved.current = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function setFile(file: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (!file) {
      setPreview(null);
      setDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setPreview(url);
    const probe = new Image();
    probe.onload = () => {
      setDims({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.src = url;
  }

  function openPicker(source: "camera" | "gallery") {
    const input = fileInputRef.current;
    if (!input) return;
    if (source === "camera") input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.value = "";
    input.click();
  }

  function clear() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
  }

  const hasSelection = !!preview && !!dims;

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="width" value={dims?.width ?? 0} />
      <input type="hidden" name="height" value={dims?.height ?? 0} />
      <input
        ref={fileInputRef}
        type="file"
        name="photo"
        accept="image/*"
        required
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {!hasSelection ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openPicker("camera")}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed bg-card transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Camera size={18} className="text-primary" />
            <span className="text-xs font-medium">Zrób zdjęcie</span>
          </button>
          <button
            type="button"
            onClick={() => openPicker("gallery")}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed bg-card transition-colors hover:border-primary hover:bg-primary/5"
          >
            <ImageIcon size={18} className="text-primary" />
            <span className="text-xs font-medium">Z galerii</span>
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview!} alt="Podgląd" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            onClick={clear}
            aria-label="Usuń wybór"
            className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending || !hasSelection} className="w-full">
        {pending ? "Wysyłam…" : "Dodaj zdjęcie"}
      </Button>
    </form>
  );
}
