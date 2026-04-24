import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { groupMembers, photos, places } from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import { err, ok, type Result } from "../result";

export type PhotoView = {
  id: string;
  placeId: string;
  userId: string;
  storagePath: string;
  width: number;
  height: number;
  isCover: boolean;
  createdAt: Date;
  url: string;
};

async function userCanAccessPlace(placeId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function listPhotosForPlace(
  placeId: string,
  userId: string,
): Promise<PhotoView[]> {
  if (!(await userCanAccessPlace(placeId, userId))) return [];
  // Cover first, then newest. The hero gallery reads this order
  // directly — no re-sorting needed client-side.
  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.placeId, placeId))
    .orderBy(desc(photos.isCover), desc(photos.createdAt));

  const storage = await getStorage();
  return rows.map((r) => ({
    id: r.id,
    placeId: r.placeId,
    userId: r.userId,
    storagePath: r.storagePath,
    width: r.width,
    height: r.height,
    isCover: r.isCover,
    createdAt: r.createdAt,
    url: storage.publicUrl(PHOTO_BUCKET, r.storagePath),
  }));
}

export async function addPhoto(
  placeId: string,
  userId: string,
  file: File,
  dimensions: { width: number; height: number },
): Promise<Result<{ id: string; path: string }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${placeId}/${userId}/${Date.now()}.${ext}`;

  const storage = await getStorage();
  const uploaded = await storage.upload({
    bucket: PHOTO_BUCKET,
    path,
    body: file,
    contentType: file.type || "image/jpeg",
  });
  if (!uploaded.ok) return err(uploaded.error);

  // If the place has no cover yet, this upload becomes the cover — so a
  // freshly added place with its first photo auto-gets a wizytówka.
  const [existingCover] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.placeId, placeId), eq(photos.isCover, true)))
    .limit(1);
  const isCover = !existingCover;

  const [row] = await db
    .insert(photos)
    .values({
      placeId,
      userId,
      storagePath: uploaded.path,
      width: dimensions.width,
      height: dimensions.height,
      isCover,
    })
    .returning({ id: photos.id });

  return ok({ id: row.id, path: uploaded.path });
}

/**
 * Promote a photo to be the cover for its place. Clears the previous
 * cover first so the place never has two covers. Any group member
 * with access to the place can change the cover — it's a shared
 * scrapbook, and we don't gatekeep aesthetic choices.
 */
export async function setCoverPhoto(
  photoId: string,
  userId: string,
): Promise<Result<{ placeId: string }>> {
  // Locate the photo + its place + verify membership in one query.
  const [row] = await db
    .select({ id: photos.id, placeId: photos.placeId })
    .from(photos)
    .innerJoin(places, eq(places.id, photos.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(photos.id, photoId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!row) return err("Brak dostępu do tego zdjęcia.");

  // Clear any other cover in the same place, then promote this one.
  // Two simple writes are easier to reason about than a single
  // parametrised CASE; Postgres handles both atomically under the
  // default read-committed isolation for the sub-second window.
  await db
    .update(photos)
    .set({ isCover: false })
    .where(
      and(
        eq(photos.placeId, row.placeId),
        eq(photos.isCover, true),
        ne(photos.id, photoId),
      ),
    );
  await db.update(photos).set({ isCover: true }).where(eq(photos.id, photoId));

  return ok({ placeId: row.placeId });
}

