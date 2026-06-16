import { cn } from "@/lib/utils";
import type { YearMonth } from "@/domain/year-review/service";

const MONTHS_PL = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];

/**
 * 12-bar monthly activity timeline — the recap's signature visual. Bar
 * height is proportional to that month's contributions; the busiest month
 * is highlighted in full primary, the rest in a tint. Pure CSS, no chart
 * lib (mobile/bundle), server-rendered.
 */
export function MonthlyBars({ months }: { months: YearMonth[] }) {
  const max = months.reduce((m, x) => Math.max(m, x.count), 0) || 1;
  // Index of the busiest month (first one wins on ties); -1 when empty.
  let peak = -1;
  let peakCount = 0;
  months.forEach((mo, i) => {
    if (mo.count > peakCount) {
      peakCount = mo.count;
      peak = i;
    }
  });

  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {months.map((mo, i) => {
          const h = mo.count === 0 ? 0 : Math.max(6, (mo.count / max) * 100);
          return (
            <div key={mo.month} className="flex h-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-md transition-colors",
                  i === peak ? "bg-primary" : "bg-primary/25",
                )}
                style={{ height: `${h}%` }}
                title={`${MONTHS_PL[i]}: ${mo.count}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {months.map((mo, i) => (
          <span
            key={mo.month}
            className={cn(
              "flex-1 text-center text-[9px] tabular-nums",
              i === peak
                ? "font-medium text-primary"
                : "text-muted-foreground/70",
            )}
          >
            {MONTHS_PL[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
