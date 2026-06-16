import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { profiles } from "@/infra/db/schema";
import { AVATAR_BUCKET, getStorage } from "@/infra/storage";
import { err, ok, type Result } from "../result";

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row ?? null;
}

const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB — more than enough.

/**
 * Upload a new avatar for the user and persist its public URL on the
 * profile row. The object path is scoped by user id so RLS / storage
 * policies can restrict writes to the owner; upsert:true lets us
 * reuse the same filename without accumulating leftovers.
 */
export async function updateAvatar(
  userId: string,
  file: File,
): Promise<Result<{ url: string }>> {
  if (file.size === 0) return err("Wybierz plik.");
  if (file.size > MAX_AVATAR_BYTES) return err("Plik większy niż 4 MB.");
  if (!file.type.startsWith("image/")) return err("Tylko obrazy.");

  // Pin to a simple extension per MIME so the final URL is predictable
  // and the old file is overwritten on re-upload.
  const ext = file.type.split("/")[1]?.split("+")[0] ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const storage = await getStorage();
  const uploaded = await storage.upload({
    bucket: AVATAR_BUCKET,
    path,
    body: file,
    contentType: file.type,
    upsert: true,
  });
  if (!uploaded.ok) return err(uploaded.error);

  // Cache-busting query so browsers pick up the new image on the next
  // page render without stale-URL headaches.
  const url = `${storage.publicUrl(AVATAR_BUCKET, uploaded.path)}?v=${Date.now()}`;

  await db
    .update(profiles)
    .set({ avatarUrl: url })
    .where(eq(profiles.id, userId));

  return ok({ url });
}

/**
 * One-time self-heal: copy the OAuth avatar (from auth metadata) into the
 * profile row when it's still empty. Profiles minted before the avatar was
 * captured kept a NULL `avatar_url`, which only `/me` masked via a
 * `?? user.avatarUrl` fallback — the activity feed and group member lists
 * read the column directly and showed initials.
 *
 * Guarded `WHERE avatar_url IS NULL`, so once healed it's a no-op and it
 * never clobbers a custom uploaded avatar. Best-effort: callers invoke it
 * via `after()` so a failure or the extra round-trip never touches the
 * render path.
 */
export async function ensureProfileAvatar(
  userId: string,
  avatarUrl: string,
): Promise<void> {
  try {
    await db
      .update(profiles)
      .set({ avatarUrl })
      .where(and(eq(profiles.id, userId), isNull(profiles.avatarUrl)));
  } catch (e) {
    console.error("[profile] avatar self-heal failed:", e);
  }
}

export async function clearAvatar(userId: string): Promise<Result<null>> {
  await db
    .update(profiles)
    .set({ avatarUrl: null })
    .where(eq(profiles.id, userId));
  return ok(null);
}
