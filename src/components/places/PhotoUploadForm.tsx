"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addPhotoAction } from "@/app/(app)/places/[id]/actions";
import { compressImage } from "@/lib/compress-image";

type State = { error: string } | { ok: true } | null;

export function PhotoUploadForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    addPhotoAction,
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Hold the active object URL in a ref so we revoke it exactly once
  // — at selection change or on unmount. Revoking *before* the <img>
  // paints is what caused the broken-icon preview historically.
  const urlRef = useRef<string | null>(null);

  // Compressed file lives entirely in React state; we never try to
  // mutate input.files (DataTransfer is unreliable on iOS Safari and
  // costs us a working preview when it silently fails). Form submit
  // pulls this file via a wrapper around the action below.
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKB: number;
    compressedKB: number;
  } | null>(null);

  const error = state && "error" in state ? state.error : null;
  const saved = !!(state && "ok" in state && state.ok === true);

  // Clear selection after a successful upload so the picker returns
  // to its empty state and toast the success instead of leaving it
  // inline.
  const prevSaved = useRef(false);
  useEffect(() => {
    if (saved && !prevSaved.current) {
      clearSelection();
      toast.success("Zdjęcie dodane.");
    }
    prevSaved.current = saved;
  }, [saved]);

  // Revoke the current blob URL on unmount.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function clearSelection() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreparedFile(null);
    setPreview(null);
    setDims(null);
    setCompressionInfo(null);
    setCompressing(false);
  }

  async function handleFilePick(file: File | null) {
    // Wipe previous selection up front so the user sees an immediate
    // state change even before compression finishes.
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreparedFile(null);
    setPreview(null);
    setDims(null);
    setCompressionInfo(null);

    if (!file) {
      setCompressing(false);
      return;
    }

    setCompressing(true);
    let prepared: File;
    try {
      const result = await compressImage(file);
      prepared = result.file;
      if (result.wasCompressed) {
        setCompressionInfo({
          originalKB: Math.round(result.originalBytes / 1024),
          compressedKB: Math.round(result.compressedBytes / 1024),
        });
      }
    } catch {
      // Defensive — compressImage already swallows internal errors,
      // but if anything bubbles we still want the picker usable.
      toast.error("Nie udało się przetworzyć zdjęcia.");
      setCompressing(false);
      return;
    }

    // Build the preview URL and read dimensions. Done after the await
    // so React batches a single render with the final values.
    const url = URL.createObjectURL(prepared);
    urlRef.current = url;
    const probe = new Image();
    probe.onload = () => {
      setDims({ width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.onerror = () => {
      // The compressed blob can't be decoded — treat the same as a
      // failed compression so the user can retry with the original.
      toast.error("Podgląd niedostępny — spróbuj inny plik.");
      clearSelection();
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

  // Action wrapper: replaces the <input type="file"> entry with the
  // compressed file from state before delegating to the real action.
  // This avoids the brittle DataTransfer dance — the file input only
  // exists to trigger the OS picker; it never carries the upload
  // payload.
  async function submit(formData: FormData) {
    if (!preparedFile) return;
    formData.set("photo", preparedFile, preparedFile.name);
    return action(formData);
  }

  const hasSelection = !!preparedFile && !!preview && !!dims;

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="width" value={dims?.width ?? 0} />
      <input type="hidden" name="height" value={dims?.height ?? 0} />
      {/* The input only opens the OS picker. The actual upload
       *  payload comes from React state via the `submit` wrapper. */}
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
              onClick={clearSelection}
              aria-label="Usuń wybór"
              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background"
            >
              <X size={16} />
            </button>
          </div>
          {compressionInfo && (
            <p className="text-[11px] italic text-muted-foreground">
              Skompresowano: {compressionInfo.originalKB} KB →{" "}
              {compressionInfo.compressedKB} KB
            </p>
          )}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

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
