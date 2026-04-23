import { and, desc, eq } from "drizzle-orm";
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
  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.placeId, placeId))
    .orderBy(desc(photos.createdAt));

  const storage = await getStorage();
  return rows.map((r) => ({
    id: r.id,
    placeId: r.placeId,
    userId: r.userId,
    storagePath: r.storagePath,
    width: r.width,
    height: r.height,
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

  const [row] = await db
    .insert(photos)
    .values({
      placeId,
      userId,
      storagePath: uploaded.path,
      width: dimensions.width,
      height: dimensions.height,
    })
    .returning({ id: photos.id });

  return ok({ id: row.id, path: uploaded.path });
}
