"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { VisitRow } from "./VisitRow";

const COLLAPSED_LIMIT = 5;

export function VisitList({
  visits,
  placeId,
  currentUserId,
}: {
  visits: {
    id: string;
    userId: string;
    userDisplayName: string;
    visitedAt: Date;
    note: string | null;
  }[];
  placeId: string;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (visits.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak wizyt jeszcze.</p>;
  }

  const visible =
    expanded || visits.length <= COLLAPSED_LIMIT
      ? visits
      : visits.slice(0, COLLAPSED_LIMIT);
  const hidden = visits.length - visible.length;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((v) => (
          <VisitRow
            key={v.id}
            visit={v}
            placeId={placeId}
            canDelete={v.userId === currentUserId}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
        >
          <ChevronDown size={14} />
          Pokaż wszystkie ({visits.length})
        </button>
      )}
    </div>
  );
}
