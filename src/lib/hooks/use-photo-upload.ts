"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compress-image";
import type { Options as CompressOptions } from "browser-image-compression";

/**
 * Discriminated state every server action that backs an upload form
 * is expected to settle to. Both place and item photo actions already
 * conform; if a future caller needs richer state we can widen to a
 * generic constraint.
 */
export type PhotoUploadState = { error: string } | { ok: true } | null;

export type PhotoAction = (
  state: PhotoUploadState,
  formData: FormData,
) => Promise<PhotoUploadState>;

export type UsePhotoUploadOptions = {
  /** Fires once per saved=true transition. */
  onSuccess?: () => void;
  /** Override compression budget — defaults match place/item photos. */
  compressOptions?: CompressOptions;
  /** FormData field the server action reads. Default "photo". */
  fileFieldName?: string;
};

export type PhotoUploadController = {
  /** Latest server-action state — null until first submit. */
  state: PhotoUploadState;
  /** True while a server action is in flight. */
  pending: boolean;
  /** Error message from the last server-action settlement, if any. */
  error: string | null;
  /** True iff the latest settlement was a successful save. */
  saved: boolean;
  /** True while the picked file is being compressed on the client. */
  compressing: boolean;
  /** Compressed File ready to upload — null until the user has picked. */
  preparedFile: File | null;
  /** Object URL for `<img src>`. Auto-revoked on selection change / unmount. */
  preview: string | null;
  /** Natural pixel dimensions of `preparedFile`. */
  dims: { width: number; height: number } | null;
  /** Ref for the hidden `<input type="file">` element. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** Open the OS picker; "camera" sets the capture attribute. */
  openPicker: (source: "camera" | "gallery") => void;
  /** Wire to the hidden file input's onChange. */
  handleFilePick: (file: File | null) => Promise<void>;
  /** Wipe selection (revokes the URL too). */
  clearSelection: () => void;
  /**
   * Action wrapper for `<form action>`. Replaces the file field on the
   * incoming FormData with the compressed file from state, then calls
   * the underlying server action. If no file is prepared, no-op.
   */
  submit: (formData: FormData) => Promise<void>;
};

/**
 * Shared upload pipeline for image-attached forms (place photos, item
 * photos, future cover photos…). Owns:
 *
 *   - the file picker input ref
 *   - on-pick compression (+ spinner state)
 *   - preview URL with safe revocation
 *   - read of natural dimensions for server-side storage
 *   - a submit-action wrapper that swaps in the compressed File via
 *     FormData.set, sidestepping the DataTransfer / input.files
 *     mutation that's flaky on iOS Safari
 *
 * The hook is presentation-agnostic — pair it with `<PhotoPicker>` for
 * the standard UI, or render your own.
 */
export function usePhotoUpload(
  action: PhotoAction,
  options: UsePhotoUploadOptions = {},
): PhotoUploadController {
  const { onSuccess, compressOptions, fileFieldName = "photo" } = options;

  const [state, dispatch, pending] = useActionState<PhotoUploadState, FormData>(
    action,
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [compressing, setCompressing] = useState(false);

  const error = state && "error" in state ? state.error : null;
  const saved = !!(state && "ok" in state && state.ok === true);

  // Run onSuccess + auto-clear exactly once per saved=true transition,
  // never on re-render. Defaults are sensible: clear the picker so it
  // returns to its empty state and the user can add another photo.
  const prevSavedRef = useRef(false);
  useEffect(() => {
    if (saved && !prevSavedRef.current) {
      clearSelection();
      onSuccess?.();
    }
    prevSavedRef.current = saved;
    // clearSelection / onSuccess are stable enough for this pattern;
    // re-running on their identity changes would risk double-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  // Revoke the active blob URL on unmount so we don't leak.
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
    setCompressing(false);
  }

  async function handleFilePick(file: File | null) {
    // Wipe immediately so the user sees feedback before compression
    // resolves on slow phones.
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
      const result = await compressImage(file, compressOptions);
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
      // Compressed blob can't be decoded — bail rather than leave the
      // picker in a stuck "no preview, no submit" state.
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

  async function submit(formData: FormData) {
    if (!preparedFile) return;
    formData.set(fileFieldName, preparedFile, preparedFile.name);
    return dispatch(formData);
  }

  return {
    state,
    pending,
    error,
    saved,
    compressing,
    preparedFile,
    preview,
    dims,
    fileInputRef,
    openPicker,
    handleFilePick,
    clearSelection,
    submit,
  };
}

/** Internal — exported only for the picker UI's onChange forwarding. */
export type { CompressOptions };
