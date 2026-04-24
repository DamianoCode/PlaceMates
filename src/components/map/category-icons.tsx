import { createElement } from "react";
import {
  BedDouble,
  Beer,
  Coffee,
  Croissant,
  IceCream,
  MapPin,
  Mountain,
  Sparkles,
  ShoppingBag,
  Trees,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Category slug → marker glyph. Keep in sync with the built-in seed
 * slugs in scripts/seed-categories.ts. Unknown slugs fall back to a
 * generic pin so custom per-group categories still render.
 */
const BY_SLUG: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  "ice-cream": IceCream,
  bakery: Croissant,
  viewpoint: Mountain,
  attraction: Sparkles,
  park: Trees,
  beach: Waves,
  bar: Beer,
  accommodation: BedDouble,
  shop: ShoppingBag,
  other: MapPin,
};

export function iconForCategorySlug(slug: string | null | undefined): LucideIcon {
  if (!slug) return MapPin;
  return BY_SLUG[slug] ?? MapPin;
}

/**
 * Render-safe wrapper around iconForCategorySlug. React 19's
 * static-components rule rejects PascalCase aliases created in
 * render, so we go through createElement directly instead.
 */
export function CategoryIcon({
  slug,
  ...rest
}: { slug: string | null | undefined } & LucideProps) {
  return createElement(iconForCategorySlug(slug), rest);
}
