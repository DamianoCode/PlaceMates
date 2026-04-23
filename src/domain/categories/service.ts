import { eq, isNull, or } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { categories } from "@/infra/db/schema";
import type { RatingDimension } from "@/infra/db/schema";

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  groupId: string | null;
  ratingSchema: RatingDimension[];
};

/** Built-ins (group_id NULL) + group-scoped categories, merged. */
export async function listCategoriesForGroup(groupId: string): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(or(isNull(categories.groupId), eq(categories.groupId, groupId)));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    icon: r.icon,
    groupId: r.groupId,
    ratingSchema: r.ratingSchema,
  }));
}

export async function getCategory(id: string): Promise<Category | null> {
  const [r] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    icon: r.icon,
    groupId: r.groupId,
    ratingSchema: r.ratingSchema,
  };
}
