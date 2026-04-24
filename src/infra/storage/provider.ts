export type UploadInput = {
  bucket: string;
  path: string;
  body: Blob | ArrayBuffer | Uint8Array | File;
  contentType: string;
  /** Overwrite any existing object at the same path. Defaults to false. */
  upsert?: boolean;
};

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export interface FileStorage {
  upload(input: UploadInput): Promise<UploadResult>;
  /** Public URL for a stored object. For private buckets, implement `signedUrl`. */
  publicUrl(bucket: string, path: string): string;
  signedUrl(bucket: string, path: string, expiresInSec: number): Promise<string | null>;
  remove(bucket: string, path: string): Promise<void>;
}
