import { createSupabaseServer } from "../auth/supabase/server";
import { createSupabaseStorage } from "./supabase";
import type { FileStorage } from "./provider";

export type { FileStorage, UploadInput, UploadResult } from "./provider";

export const PHOTO_BUCKET = "place-photos";
export const AVATAR_BUCKET = "avatars";

export async function getStorage(): Promise<FileStorage> {
  const client = await createSupabaseServer();
  return createSupabaseStorage(client);
}
