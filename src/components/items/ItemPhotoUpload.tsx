"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addItemPhotoAction,
  type AddItemPhotoState,
} from "@/app/(app)/places/[id]/item-actions";
import { compressImage } from "@/lib/compress-image";

/** Same two-source pattern as place photos: camera or gallery. */
export function ItemPhotoUpload({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<AddItemPhotoState, FormData>(
    addItemPhotoAction,
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const error = state && "error" in state ? state.error : null;
  const saved = !!(state && "ok" in state && state.ok === true);

  const prevSaved = useRef(false);
  useEffect(() => {
    if (saved && !prevSaved.current) {
      clear();
      toast.success("Zdjęcie dodane.");
    }
    prevSaved.current = saved;
  }, [saved]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function clear() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreparedFile(null);
    setPreview(null);
    setDims(null);
    setCompressing(false);
  }

  async function handleFilePick(file: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreparedFile(null);
    setPreview(null);
    setDims(null);

    if (!file) {
      setCompressing(false);
      return;
    }

    setCompressing(true);
    let prepared: File;
    try {
      const result = await compressImage(file);
      prepared = result.file;
    } catch {
      toast.error("Nie udało się przetworzyć zdjęcia.");
      setCompressing(false);
      return;
    }

    const url = URL.createObjectURL(prepared);
    urlRef.current = url;
    const probe = new Image();
    probe.onload = () => {
      setDims({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.onerror = () => {
      toast.error("Podgląd niedostępny — spróbuj inny plik.");
      clear();
    };
    probe.src = url;
    setPreview(url);
    setPreparedFile(prepared);
    setCompressing(false);
  }

  function openPicker(source: "camera" | "gallery") {
    const input = fileInputRef.current;
    if (!input) return;
    if (source === "camera") input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.value = "";
    input.click();
  }

  async function submit(formData: FormData) {
    if (!preparedFile) return;
    formData.set("photo", preparedFile, preparedFile.name);
    return action(formData);
  }

  const hasSelection = !!preparedFile && !!preview && !!dims;

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="width" value={dims?.width ?? 0} />
      <input type="hidden" name="height" value={dims?.height ?? 0} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void handleFilePick(e.target.files?.[0] ?? null);
        }}
      />

      {!hasSelection && !compressing && (
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
      )}

      {compressing && (
        <div className="flex h-14 items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Optymalizuję zdjęcie…
        </div>
      )}

      {hasSelection && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview!}
              alt="Podgląd"
              className="max-h-56 w-full object-cover"
            />
            <button
              type="button"
              onClick={clear}
              aria-label="Usuń wybór"
              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        disabled={pending || compressing || !hasSelection}
        className="w-full"
      >
        {pending
          ? "Wysyłam…"
          : compressing
            ? "Optymalizuję…"
            : "Dodaj zdjęcie"}
      </Button>
    </form>
  );
}
