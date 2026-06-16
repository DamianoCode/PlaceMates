import {
  Camera,
  Footprints,
  MapPin,
  Shapes,
  Star,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { GroupInsightCounts } from "@/domain/insights/service";
import { plural } from "@/lib/plural";
import { StaggerList } from "@/components/layout/StaggerList";

/**
 * Headline counters for the group Insights dashboard. Server-rendered,
 * no interactivity — a plain responsive grid of stat tiles. Each tile is
 * decorative-icon + big number + label, echoing the card vocabulary used
 * elsewhere (rounded-2xl border bg-card).
 */
type Counter = {
  key: keyof GroupInsightCounts;
  icon: LucideIcon;
  /** Singular/plural-2/plural-many for the Polish label under the number. */
  forms: [string, string, string];
};

const COUNTERS: Counter[] = [
  { key: "places", icon: MapPin, forms: ["miejsce", "miejsca", "miejsc"] },
  { key: "rated", icon: Utensils, forms: ["ocenione", "ocenione", "ocenionych"] },
  { key: "ratings", icon: Star, forms: ["ocena", "oceny", "ocen"] },
  { key: "visits", icon: Footprints, forms: ["wizyta", "wizyty", "wizyt"] },
  { key: "photos", icon: Camera, forms: ["zdjęcie", "zdjęcia", "zdjęć"] },
  { key: "categories", icon: Shapes, forms: ["kategoria", "kategorie", "kategorii"] },
];

export function CounterGrid({ counts }: { counts: GroupInsightCounts }) {
  return (
    <StaggerList as="ul" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {COUNTERS.map(({ key, icon: Icon, forms }) => {
        const value = counts[key];
        return (
          <li
            key={key}
            className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <span className="font-display text-3xl leading-none tabular-nums">
              {value}
            </span>
            <span className="text-xs text-muted-foreground">
              {plural(value, forms)}
            </span>
          </li>
        );
      })}
    </StaggerList>
  );
}
