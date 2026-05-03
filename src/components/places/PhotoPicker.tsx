"use client";

import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoUploadController } from "@/lib/hooks/use-photo-upload";

/**
 * Standard UI for a photo upload form: camera/gallery picker → spinner
 * during compression → preview with clear button → submit.
 *
 * Stateless — all state and handlers come from a `usePhotoUpload`
 * controller. Caller passes any extra hidden inputs (placeId, itemId,
 * canonicalId, etc.) as `children`; width/height are added here so
 * every uploader picks up the natural dimensions automatically.
 */
export function PhotoPicker({
  upload,
  submitLabel = "Dodaj zdjęcie",
  children,
}: {
  upload: PhotoUploadController;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  const {
    pending,
    compressing,
    preparedFile,
    preview,
    dims,
    error,
    fileInputRef,
    openPicker,
    handleFilePick,
    clearSelection,
    submit,
  } = upload;

  const hasSelection = !!preparedFile && !!preview && !!dims;

  return (
    <form action={submit} className="space-y-3">
      {/* Width/height are server-side persisted alongside the photo. */}
      <input type="hidden" name="width" value={dims?.width ?? 0} />
      <input type="hidden" name="height" value={dims?.height ?? 0} />
      {children}
      {/* Hidden picker input. Only role: open the OS picker. The
       *  upload payload is swapped in by the controller's submit
       *  wrapper, never read from this input's .files. */}
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
            : submitLabel}
      </Button>
    </form>
  );
}
