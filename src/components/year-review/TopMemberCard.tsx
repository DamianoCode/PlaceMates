import { Crown } from "lucide-react";
import { plural } from "@/lib/plural";
import type { YearTopMember } from "@/domain/year-review/service";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * "Gwiazda roku" — the member with the most contributions. Oversized
 * avatar with a crown, gold-washed panel, big name + a contribution
 * tally. Initials fallback when there's no photo.
 */
export function TopMemberCard({ member }: { member: YearTopMember }) {
  return (
    <div className="relative flex items-center gap-5 overflow-hidden rounded-3xl border border-star/40 bg-star/10 p-6">
      <Crown
        size={120}
        strokeWidth={1}
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-5 rotate-12 text-star/25"
      />
      <div className="relative flex-shrink-0">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/15 font-display text-3xl font-semibold text-primary ring-2 ring-star/60">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            initials(member.displayName)
          )}
        </div>
        <span className="absolute -right-1 -top-2 flex h-8 w-8 -rotate-12 items-center justify-center rounded-full bg-star text-star-foreground shadow-md ring-2 ring-card">
          <Crown size={16} className="fill-current" />
        </span>
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
          Gwiazda roku
        </p>
        <p className="mt-0.5 truncate font-display text-3xl leading-tight">
          {member.displayName}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {member.total}{" "}
          {plural(member.total, ["wkład", "wkłady", "wkładów"])} w tym roku
        </p>
      </div>
    </div>
  );
}
