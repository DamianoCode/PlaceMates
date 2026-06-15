import { Star } from "lucide-react";
import type { CategoryBreakdownRow } from "@/domain/insights/service";
import { CategoryIcon } from "@/components/map/category-icons";
import { plural } from "@/lib/plural";

/**
 * Category breakdown of the group's rated places — a lightweight CSS bar
 * chart (no chart library, keeps the mobile bundle small). Bar length is
 * proportional to the place count in each category; the average rating
 * rides along on the right. Server-rendered and static.
 */
export function CategoryBreakdown({
  rows,
}: {
  rows: CategoryBreakdownRow[];
}) {
  // Scale bars against the busiest category so the leader fills the track.
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = Math.max(6, Math.round((row.count / max) * 100));
        return (
          <li key={row.slug ?? "other"} className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <CategoryIcon
                slug={row.slug}
                size={16}
                strokeWidth={1.75}
                className="flex-shrink-0 text-primary/70"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.label}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Star size={12} className="fill-amber-400 stroke-amber-500" />
                {row.avg.toFixed(2)}
              </span>
              <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                {row.count} {plural(row.count, ["miejsce", "miejsca", "miejsc"])}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
