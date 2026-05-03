import imageCompression, { type Options } from "browser-image-compression";

/**
 * Defaults tuned for place / item photos in this app:
 *   - 1.5 MB ceiling — well under any plausible Server Action limit
 *     and still big enough for a sharp full-screen view.
 *   - 2048 px on the longest side — retina-friendly without bloating
 *     the file for thumbnails the user will mostly see.
 *   - Web Worker on so the main thread stays responsive while the
 *     library re-encodes the canvas.
 *   - useWebWorker auto-falls-back to main thread on browsers that
 *     don't support OffscreenCanvas.
 *   - alwaysKeepResolution=false — we *want* the dimension cap.
 */
const DEFAULT_OPTIONS: Options = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  // Strip EXIF orientation by re-encoding (the library auto-rotates
  // the canvas to match the EXIF orientation before encoding, so the
  // output is "physically" upright and safe for browsers that ignore
  // EXIF).
  preserveExif: false,
};

export type CompressionResult = {
  /** The (possibly) compressed blob, named to match the input file. */
  file: File;
  /** Original file size in bytes. */
  originalBytes: number;
  /** Output file size in bytes. */
  compressedBytes: number;
  /** True iff we replaced the source — false when the original was
   *  already small enough or when compression failed and we fell back. */
  wasCompressed: boolean;
};

/**
 * Compress an image file before upload. SVG and animated formats pass
 * through unchanged (compressing them would lose information or break
 * the animation). PNGs, JPEGs and HEIC blobs from phone cameras get
 * re-encoded down toward `maxSizeMB`.
 *
 * Returns the original file untouched on any compression error — it's
 * better to attempt the upload at full size and let the server reject
 * than to fail loudly here for an obscure browser quirk.
 */
export async function compressImage(
  file: File,
  options: Options = {},
): Promise<CompressionResult> {
  const originalBytes = file.size;

  // Don't touch SVGs — they're vector and tiny by definition; the
  // canvas-based compressor would rasterise them, blowing up size and
  // losing scalability.
  if (file.type === "image/svg+xml") {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  }

  // Already small enough — skip the work. The Server Action limit is
  // 10 MB; we use a generous 900 KB skip threshold so we don't
  // re-encode files that wouldn't shrink meaningfully anyway.
  const skipThresholdBytes = 900 * 1024;
  if (originalBytes <= skipThresholdBytes) {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  }

  try {
    const merged: Options = { ...DEFAULT_OPTIONS, ...options };
    const compressed = await imageCompression(file, merged);
    return {
      file: compressed,
      originalBytes,
      compressedBytes: compressed.size,
      wasCompressed: true,
    };
  } catch {
    // Defensive: any failure → upload the original. Worse-case the
    // Server Action ceiling rejects it and the user sees a clean
    // error from the existing path.
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  }
}
