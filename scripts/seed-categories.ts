/**
 * Seed built-in categories (group_id = NULL). Idempotent: upsert by slug.
 * Run: npm run db:seed
 */
import { sql } from "drizzle-orm";
import { db } from "../src/infra/db/client";
import { categories, type RatingDimension } from "../src/infra/db/schema";

type Seed = {
  slug: string;
  name: string;
  icon: string;
  ratingSchema: RatingDimension[];
};

const d = (key: string, label: string): RatingDimension => ({
  key,
  label,
  min: 1,
  max: 5,
});

const BUILTINS: Seed[] = [
  {
    slug: "restaurant",
    name: "Restauracja",
    icon: "utensils",
    ratingSchema: [d("food", "Jedzenie"), d("service", "Obsługa"), d("ambience", "Atmosfera"), d("price", "Cena")],
  },
  {
    slug: "cafe",
    name: "Kawiarnia",
    icon: "coffee",
    ratingSchema: [d("coffee", "Kawa"), d("ambience", "Atmosfera"), d("service", "Obsługa"), d("price", "Cena")],
  },
  {
    slug: "ice-cream",
    name: "Lodziarnia",
    icon: "ice-cream",
    ratingSchema: [d("taste", "Smak"), d("variety", "Wybór"), d("price", "Cena")],
  },
  {
    slug: "bakery",
    name: "Piekarnia / Cukiernia",
    icon: "croissant",
    ratingSchema: [d("taste", "Smak"), d("freshness", "Świeżość"), d("price", "Cena")],
  },
  {
    slug: "viewpoint",
    name: "Punkt widokowy",
    icon: "mountain",
    ratingSchema: [d("view", "Widok"), d("access", "Dostępność"), d("crowd", "Tłok (1 = tłumnie)")],
  },
  {
    slug: "attraction",
    name: "Atrakcja",
    icon: "sparkles",
    ratingSchema: [d("experience", "Wrażenie"), d("price", "Cena"), d("crowd", "Tłok (1 = tłumnie)")],
  },
  {
    slug: "park",
    name: "Park / Przyroda",
    icon: "trees",
    ratingSchema: [d("scenery", "Przyroda"), d("facilities", "Udogodnienia"), d("crowd", "Tłok (1 = tłumnie)")],
  },
  {
    slug: "beach",
    name: "Plaża",
    icon: "waves",
    ratingSchema: [d("sand", "Piasek/Woda"), d("facilities", "Udogodnienia"), d("crowd", "Tłok (1 = tłumnie)")],
  },
  {
    slug: "bar",
    name: "Bar / Pub",
    icon: "beer",
    ratingSchema: [d("drinks", "Napoje"), d("ambience", "Atmosfera"), d("price", "Cena")],
  },
  {
    slug: "accommodation",
    name: "Nocleg",
    icon: "bed",
    ratingSchema: [d("comfort", "Komfort"), d("cleanliness", "Czystość"), d("location", "Lokalizacja"), d("price", "Cena")],
  },
  {
    slug: "shop",
    name: "Sklep / Lokalne produkty",
    icon: "shopping-bag",
    ratingSchema: [d("quality", "Jakość"), d("variety", "Wybór"), d("price", "Cena")],
  },
  {
    slug: "other",
    name: "Inne",
    icon: "map-pin",
    ratingSchema: [d("overall", "Ogólnie")],
  },
];

async function main() {
  for (const c of BUILTINS) {
    await db
      .insert(categories)
      .values({
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        groupId: null,
        ratingSchema: c.ratingSchema,
      })
      .onConflictDoUpdate({
        target: [categories.slug],
        targetWhere: sql`${categories.groupId} IS NULL`,
        set: { name: c.name, icon: c.icon, ratingSchema: c.ratingSchema },
      });
  }
  console.log(`Seeded ${BUILTINS.length} built-in categories.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
