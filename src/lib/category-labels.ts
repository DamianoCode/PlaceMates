/**
 * Built-in category slug → Polish display label (plural form, reads well
 * as a section/breakdown heading). Mirrors the built-in seed slugs in
 * scripts/seed-categories.ts and the FILTERS list on /ranking. Unknown
 * or custom per-group slugs (and NULL) fall back to "Inne" so a
 * breakdown never renders a raw slug.
 *
 * Companion to `iconForCategorySlug` in components/map/category-icons —
 * keep both maps in sync when a built-in is added.
 */
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restauracje",
  cafe: "Kawiarnie",
  "ice-cream": "Lodziarnie",
  bakery: "Piekarnie",
  viewpoint: "Widoki",
  attraction: "Atrakcje",
  park: "Parki",
  beach: "Plaże",
  bar: "Bary",
  accommodation: "Noclegi",
  shop: "Sklepy",
  other: "Inne",
};

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "Inne";
  return CATEGORY_LABELS[slug] ?? "Inne";
}
