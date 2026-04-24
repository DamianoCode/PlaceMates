import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileStorage, UploadInput, UploadResult } from "./provider";

export function createSupabaseStorage(client: SupabaseClient): FileStorage {
  return {
    async upload({ bucket, path, body, contentType, upsert }: UploadInput): Promise<UploadResult> {
      const { error } = await client.storage.from(bucket).upload(path, body, {
        contentType,
        upsert: upsert ?? false,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, path };
    },

    publicUrl(bucket, path) {
      return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },

    async signedUrl(bucket, path, expiresInSec) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSec);
      if (error || !data) return null;
      return data.signedUrl;
    },

    async remove(bucket, path) {
      await client.storage.from(bucket).remove([path]);
    },
  };
}
