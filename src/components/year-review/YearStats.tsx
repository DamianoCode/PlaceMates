import {
  Camera,
  Footprints,
  MapPin,
  Shapes,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { plural } from "@/lib/plural";
import type { GroupInsightCounts } from "@/domain/insights/service";

/**
 * Year counters with hierarchy instead of a flat grid: two oversized hero
 * numbers (places + ratings) lead, four compact stats support. Big display
 * numerals carry the "wow"; the supporting row fills in the rest.
 */
type Forms = [string, string, string];

export function YearStats({ counts }: { counts: GroupInsightCounts }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <HeroStat
          icon={MapPin}
          value={counts.places}
          forms={["miejsce", "miejsca", "miejsc"]}
        />
        <HeroStat
          icon={Star}
          value={counts.ratings}
          forms={["ocena", "oceny", "ocen"]}
        />
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        <MiniStat icon={Camera} value={counts.photos} forms={["zdjęcie", "zdjęcia", "zdjęć"]} />
        <MiniStat icon={Footprints} value={counts.visits} forms={["wizyta", "wizyty", "wizyt"]} />
        <MiniStat icon={Sparkles} value={counts.rated} forms={["ocenione", "ocenione", "ocenionych"]} />
        <MiniStat icon={Shapes} value={counts.categories} forms={["kategoria", "kategorie", "kategorii"]} />
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  value,
  forms,
}: {
  icon: LucideIcon;
  value: number;
  forms: Forms;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
      <Icon
        size={64}
        strokeWidth={1.25}
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3 text-primary/10"
      />
      <p className="font-display text-6xl leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{plural(value, forms)}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  forms,
}: {
  icon: LucideIcon;
  value: number;
  forms: Forms;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center">
      <Icon size={16} strokeWidth={1.75} className="text-primary/70" aria-hidden />
      <p className="font-display text-xl leading-none tabular-nums">{value}</p>
      <p className="text-[10px] leading-tight text-muted-foreground">
        {plural(value, forms)}
      </p>
    </div>
  );
}
