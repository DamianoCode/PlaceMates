import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  groupMembers,
  itemPhotos,
  itemRatings,
  placeItems,
  places,
  profiles,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";
import { err, ok, type Result } from "../result";

/** Confirms the caller is a member of the place's group. */
async function userCanAccessPlace(placeId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  return !!row;
}

async function userCanAccessItem(itemId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: placeItems.id })
    .from(placeItems)
    .innerJoin(places, eq(places.id, placeItems.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(placeItems.id, itemId), eq(groupMembers.userId, userId)))
    .limit(1);
  return !!row;
}

export type ItemCard = {
  id: string;
  name: string;
  avgScore: number | null;
  ratingCount: number;
  yourScore: number | null;
  photoUrl: string | null;
  createdBy: string;
};

export async function listItemsForPlace(
  placeId: string,
  userId: string,
): Promise<ItemCard[]> {
  if (!(await userCanAccessPlace(placeId, userId))) return [];

  const items = await db
    .select({
      id: placeItems.id,
      name: placeItems.name,
      createdBy: placeItems.createdBy,
    })
    .from(placeItems)
    .where(eq(placeItems.placeId, placeId))
    .orderBy(desc(placeItems.createdAt));

  if (items.length === 0) return [];
  const ids = items.map((i) => i.id);

  const [stats, yours, photosRows] = await Promise.all([
    db
      .select({
        itemId: itemRatings.itemId,
        avg: sql<string>`AVG(${itemRatings.score})`.as("avg"),
        cnt: sql<number>`COUNT(*)::int`.as("cnt"),
      })
      .from(itemRatings)
      .where(inArray(itemRatings.itemId, ids))
      .groupBy(itemRatings.itemId),
    db
      .select({ itemId: itemRatings.itemId, score: itemRatings.score })
      .from(itemRatings)
      .where(
        and(eq(itemRatings.userId, userId), inArray(itemRatings.itemId, ids)),
      ),
    db
      .select({
        itemId: itemPhotos.itemId,
        storagePath: itemPhotos.storagePath,
      })
      .from(itemPhotos)
      .where(inArray(itemPhotos.itemId, ids))
      .orderBy(desc(itemPhotos.createdAt)),
  ]);

  const statsBy = new Map(
    stats.map((s) => [s.itemId, { avg: Number(s.avg), cnt: Number(s.cnt) }]),
  );
  const yoursBy = new Map(yours.map((y) => [y.itemId, Number(y.score)]));
  const photoBy = new Map<string, string>();
  for (const p of photosRows) {
    if (!photoBy.has(p.itemId)) photoBy.set(p.itemId, p.storagePath);
  }
  const storage = await getStorage();

  return items.map((i) => {
    const s = statsBy.get(i.id);
    const ph = photoBy.get(i.id);
    return {
      id: i.id,
      name: i.name,
      createdBy: i.createdBy,
      avgScore: s ? Math.round(s.avg * 10) / 10 : null,
      ratingCount: s?.cnt ?? 0,
      yourScore: yoursBy.get(i.id) ?? null,
      photoUrl: ph ? storage.publicUrl(PHOTO_BUCKET, ph) : null,
    };
  });
}

export type ItemDetail = {
  id: string;
  placeId: string;
  name: string;
  createdBy: string;
  createdAt: Date;
};

export async function getItemForUser(
  itemId: string,
  userId: string,
): Promise<ItemDetail | null> {
  const [row] = await db
    .select({
      id: placeItems.id,
      placeId: placeItems.placeId,
      name: placeItems.name,
      createdBy: placeItems.createdBy,
      createdAt: placeItems.createdAt,
    })
    .from(placeItems)
    .innerJoin(places, eq(places.id, placeItems.placeId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(placeItems.id, itemId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export type ItemRatingView = {
  id: string;
  userId: string;
  userDisplayName: string;
  score: number;
  note: string | null;
  updatedAt: Date;
};

export async function listItemRatings(
  itemId: string,
  userId: string,
): Promise<ItemRatingView[]> {
  if (!(await userCanAccessItem(itemId, userId))) return [];
  const rows = await db
    .select({
      id: itemRatings.id,
      userId: itemRatings.userId,
      userDisplayName: profiles.displayName,
      score: itemRatings.score,
      note: itemRatings.note,
      updatedAt: itemRatings.updatedAt,
    })
    .from(itemRatings)
    .innerJoin(profiles, eq(profiles.id, itemRatings.userId))
    .where(eq(itemRatings.itemId, itemId))
    .orderBy(desc(itemRatings.updatedAt));
  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}

export type ItemPhotoView = {
  id: string;
  userId: string;
  url: string;
  createdAt: Date;
};

export async function listItemPhotos(
  itemId: string,
  userId: string,
): Promise<ItemPhotoView[]> {
  if (!(await userCanAccessItem(itemId, userId))) return [];
  const rows = await db
    .select()
    .from(itemPhotos)
    .where(eq(itemPhotos.itemId, itemId))
    .orderBy(desc(itemPhotos.createdAt));
  const storage = await getStorage();
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    url: storage.publicUrl(PHOTO_BUCKET, r.storagePath),
    createdAt: r.createdAt,
  }));
}

export async function createItem(
  placeId: string,
  name: string,
  userId: string,
): Promise<Result<{ id: string }>> {
  if (!(await userCanAccessPlace(placeId, userId))) {
    return err("Brak dostępu do tego miejsca.");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) return err("Nazwa nie może być pusta.");
  if (trimmed.length > 120) return err("Nazwa za długa (max 120 znaków).");

  const [row] = await db
    .insert(placeItems)
    .values({ placeId, name: trimmed, createdBy: userId })
    .returning({ id: placeItems.id });
  return ok({ id: row.id });
}

export async function deleteItem(
  itemId: string,
  userId: string,
): Promise<Result<null>> {
  // Author-only delete. Cascades clean up ratings + photo rows; the
  // storage objects would be orphaned otherwise — TODO clean them up
  // once item_photos rows disappear.
  const [row] = await db
    .delete(placeItems)
    .where(and(eq(placeItems.id, itemId), eq(placeItems.createdBy, userId)))
    .returning({ id: placeItems.id });
  if (!row) return err("Tylko autor produktu może go usunąć.");
  return ok(null);
}

export async function upsertItemRating(
  itemId: string,
  userId: string,
  score: number,
  note: string | null,
): Promise<Result<null>> {
  if (!(await userCanAccessItem(itemId, userId))) {
    return err("Brak dostępu do tego produktu.");
  }
  if (score < 1 || score > 5 || Math.round(score * 2) !== score * 2) {
    return err("Ocena musi mieścić się w 1.0 – 5.0 z krokiem 0.5.");
  }

  await db
    .insert(itemRatings)
    .values({
      itemId,
      userId,
      score: score.toFixed(1),
      note,
    })
    .onConflictDoUpdate({
      target: [itemRatings.itemId, itemRatings.userId],
      set: {
        score: score.toFixed(1),
        note,
        updatedAt: new Date(),
      },
    });
  return ok(null);
}

export async function addItemPhoto(
  itemId: string,
  userId: string,
  file: File,
  dimensions: { width: number; height: number },
): Promise<Result<{ id: string }>> {
  if (!(await userCanAccessItem(itemId, userId))) {
    return err("Brak dostępu do tego produktu.");
  }
  // Reuse the same bucket as place photos. Path shape matches the
  // existing bucket RLS policy which checks foldername[2] = auth.uid():
  //   <itemId>/<userId>/<ts>.<ext>
  // Items and places share the bucket without colliding because ids
  // are UUIDs — no chance of an item and a place sharing a first
  // folder segment.
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const storage = await getStorage();
  const path = `${itemId}/${userId}/item-${Date.now()}.${ext}`;
  const uploaded = await storage.upload({
    bucket: PHOTO_BUCKET,
    path,
    body: file,
    contentType: file.type || "image/jpeg",
  });
  if (!uploaded.ok) return err(uploaded.error);

  const [row] = await db
    .insert(itemPhotos)
    .values({
      itemId,
      userId,
      storagePath: uploaded.path,
      width: dimensions.width,
      height: dimensions.height,
    })
    .returning({ id: itemPhotos.id });
  return ok({ id: row.id });
}
