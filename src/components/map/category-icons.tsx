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
