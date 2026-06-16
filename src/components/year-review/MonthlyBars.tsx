import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";
import type { YearMonth } from "@/domain/year-review/service";

const MONTHS_PL = [
  "sty", "lut", "mar", "kwi", "maj", "cze",
  "lip", "sie", "wrz", "paź", "lis", "gru",
];
const MONTHS_FULL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/**
 * Yearly activity timeline — 12 gradient bars, the busiest month crowned in
 * full saturation with its count called out above and named in the caption.
 * It's a visualization (not a month picker): the caption + value labels make
 * that unmistakable. Pure CSS, server-rendered.
 */
export function MonthlyBars({ months }: { months: YearMonth[] }) {
  const max = months.reduce((m, x) => Math.max(m, x.count), 0) || 1;
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
      <div className="flex h-44 items-end gap-1.5">
        {months.map((mo, i) => {
          const h = mo.count === 0 ? 2 : Math.max(9, (mo.count / max) * 100);
          const isPeak = i === peak && mo.count > 0;
          return (
            <div
              key={mo.month}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              {isPeak && (
                <span className="font-display text-sm font-semibold tabular-nums text-primary">
                  {mo.count}
                </span>
              )}
              <div
                className={cn(
                  "w-full rounded-md bg-gradient-to-t transition-colors",
                  isPeak
                    ? "from-primary to-amber-400 shadow-sm shadow-primary/30"
                    : "from-primary/30 to-primary/10",
                )}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {months.map((mo, i) => (
          <span
            key={mo.month}
            className={cn(
              "flex-1 text-center text-[11px]",
              i === peak
                ? "font-semibold text-foreground"
                : "text-muted-foreground/60",
            )}
          >
            {MONTHS_PL[i]}
          </span>
        ))}
      </div>

      {peak >= 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          Najgorętszy miesiąc:{" "}
          <span className="font-medium text-foreground">
            {MONTHS_FULL[peak]}
          </span>{" "}
          — {peakCount}{" "}
          {plural(peakCount, ["wydarzenie", "wydarzenia", "wydarzeń"])}.
        </p>
      )}
    </div>
  );
}
