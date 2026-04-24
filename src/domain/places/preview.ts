import { and, desc, eq } from "drizzle-orm";
import { db } from "@/infra/db/client";
import {
  categories,
  groupMembers,
  photos,
  places,
  ratings,
} from "@/infra/db/schema";
import { getStorage, PHOTO_BUCKET } from "@/infra/storage";

export type PlacePreview = {
  id: string;
  name: string;
  categoryName: string;
  /** Group-wide average; null when nobody has rated yet. */
  overall: number | null;
  ratingCount: number;
  photoUrl: string | null;
};

export async function getPlacePreview(
  placeId: string,
  userId: string,
): Promise<PlacePreview | null> {
  const [row] = await db
    .select({
      id: places.id,
      name: places.name,
      categoryName: categories.name,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(groupMembers, eq(groupMembers.groupId, places.groupId))
    .where(and(eq(places.id, placeId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!row) return null;

  const allRatings = await db
    .select({ overall: ratings.overall })
    .from(ratings)
    .where(eq(ratings.placeId, placeId));

  const overall =
    allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + Number(r.overall), 0) / allRatings.length
      : null;

  // Cover first, then newest — matches listPhotosForPlace ordering so
  // the pin preview always shows the same hero image as the place detail.
  const [firstPhoto] = await db
    .select({ storagePath: photos.storagePath })
    .from(photos)
    .where(eq(photos.placeId, placeId))
    .orderBy(desc(photos.isCover), desc(photos.createdAt))
    .limit(1);

  const photoUrl = firstPhoto
    ? (await getStorage()).publicUrl(PHOTO_BUCKET, firstPhoto.storagePath)
    : null;

  return {
    id: row.id,
    name: row.name,
    categoryName: row.categoryName,
    overall: overall !== null ? Math.round(overall * 100) / 100 : null,
    ratingCount: allRatings.length,
    photoUrl,
  };
}
