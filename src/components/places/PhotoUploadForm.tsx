"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addPhotoAction } from "@/app/(app)/places/[id]/actions";
import { compressImage } from "@/lib/compress-image";

type State = { error: string } | { ok: true } | null;

export function PhotoUploadForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(addPhotoAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Hold the active object URL in a ref so we revoke it exactly once
  // — at selection change or on unmount. Revoking *before* the <img>
  // paints is what caused the broken-icon preview.
  const urlRef = useRef<string | null>(null);

  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Phone cameras commonly produce 3-12 MB JPEGs that overshoot the
  // Next.js Server Action body cap. Compress on the client before
  // submission and surface progress so the user knows the wait isn't
  // a freeze.
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKB: number;
    compressedKB: number;
  } | null>(null);

  const error = state && "error" in state ? state.error : null;
  const saved = !!(state && "ok" in state && state.ok === true);

  // Clear selection after a successful upload so the picker returns to
  // its empty state and toast the success instead of leaving it inline.
  const prevSaved = useRef(false);
  useEffect(() => {
    if (saved && !prevSaved.current) {
      clearSelection();
      toast.success("Zdjęcie dodane.");
    }
    prevSaved.current = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  // Revoke the current blob URL on unmount.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function setFile(file: File | null) {
    // Revoke the previous blob before creating a new one.
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setCompressionInfo(null);

    if (!file) {
      setPreview(null);
      setDims(null);
      setFileName(null);
      return;
    }

    // Compress before everything else so dims, preview and the file
    // input all reflect the final upload payload. Show a spinner —
    // re-encoding a 12 MP photo on a low-end phone can easily take
    // 1-3 seconds.
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
    } finally {
      setCompressing(false);
    }

    // Replace the file input's underlying file list with the
    // compressed version so form submission picks up the smaller
    // blob (the input still holds the original from the user's
    // pick). DataTransfer is the cross-browser way to set .files.
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(prepared);
      fileInputRef.current.files = dt.files;
    }

    const url = URL.createObjectURL(prepared);
    urlRef.current = url;
    setPreview(url);
    setFileName(prepared.name);

    // Read natural dimensions for server-side storage. The image stays
    // alive in the <img> tag; we do NOT revoke the URL here.
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

  function clearSelection() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
  }

  const hasSelection = !!preview && !!dims;

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="placeId" value={placeId} />
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

      {!hasSelection && (
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

      {compressing && !hasSelection && (
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
          {fileName && (
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          )}
          {compressionInfo && (
            <p className="text-[11px] italic text-muted-foreground">
              Skompresowano: {compressionInfo.originalKB} KB →{" "}
              {compressionInfo.compressedKB} KB
            </p>
          )}
        </div>
      )}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

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
