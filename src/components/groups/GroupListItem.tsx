import Link from "next/link";
import { ChevronRight, Crown, Users } from "lucide-react";

export function GroupListItem({
  group,
}: {
  group: {
    id: string;
    name: string;
    role: "owner" | "member";
    memberCount: number;
  };
}) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Users size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-display text-base">{group.name}</p>
          {group.role === "owner" && (
            <Crown
              size={13}
              className="flex-shrink-0 text-primary"
              aria-label="Właściciel"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {group.memberCount}{" "}
          {group.memberCount === 1
            ? "osoba"
            : group.memberCount < 5
              ? "osoby"
              : "osób"}
          {" · "}
          {group.role === "owner" ? "jesteś właścicielem" : "jesteś członkiem"}
        </p>
      </div>
      <ChevronRight size={18} className="flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
