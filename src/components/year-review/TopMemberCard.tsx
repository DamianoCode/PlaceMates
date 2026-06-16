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
 * "Gwiazda roku" — the member with the most contributions. Big avatar
 * with a crown accent, name, and a contribution tally. Mirrors the
 * avatar treatment used elsewhere (initials fallback when no photo).
 */
export function TopMemberCard({ member }: { member: YearTopMember }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
      <div className="relative flex-shrink-0">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 font-display text-2xl font-semibold text-primary">
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
        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-card">
          <Crown size={14} className="fill-current" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-2xl leading-tight">
          {member.displayName}
        </p>
        <p className="text-sm text-muted-foreground">
          {member.total}{" "}
          {plural(member.total, ["wkład", "wkłady", "wkładów"])} w tym roku
        </p>
      </div>
    </div>
  );
}
