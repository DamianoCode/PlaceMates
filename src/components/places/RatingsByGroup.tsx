import { Star, Users } from "lucide-react";
import type { RatingByGroup } from "@/domain/ratings/service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Renders ratings from other users, grouped by the group they came from.
 *
 * - If every rating is in one group (or there's just one group overall),
 *   we fall through to a flat list under a single "Oceny grupy" card —
 *   visual parity with the pre-canonical layout.
 * - If multiple groups contribute ratings, each group becomes its own
 *   sub-section with a header, so comparing "nasze vs ich" is trivial.
 *
 * `currentUserId` is used to filter out the caller's own rating — that
 * one already lives in the "Twoja ocena" card above.
 */
export function RatingsByGroup({
  buckets,
  currentUserId,
}: {
  buckets: RatingByGroup[];
  currentUserId: string;
}) {
  // Strip the caller's rating from every bucket; drop empty buckets after.
  const cleaned = buckets
    .map((b) => ({
      ...b,
      ratings: b.ratings.filter((r) => r.userId !== currentUserId),
    }))
    .filter((b) => b.ratings.length > 0);

  if (cleaned.length === 0) return null;

  const multiGroup = cleaned.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Users size={18} />
          {multiGroup ? "Oceny we wszystkich grupach" : "Oceny grupy"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {cleaned.map((bucket) =>
          multiGroup ? (
            <section key={bucket.groupId} className="space-y-2">
              <header className="flex items-baseline justify-between border-b pb-1">
                <h3 className="font-display text-base">
                  W „<span className="italic">{bucket.groupName}</span>”
                </h3>
                <span className="text-xs text-muted-foreground">
                  {bucket.ratings.length}{" "}
                  {bucket.ratings.length === 1 ? "ocena" : "ocen"}
                </span>
              </header>
              <ul className="space-y-2">
                {bucket.ratings.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{r.userDisplayName}</span>
                      <span className="flex items-center gap-1 tabular-nums text-primary">
                        <Star size={14} className="fill-current" />
                        {r.overall.toFixed(2)}
                      </span>
                    </div>
                    {r.note && (
                      <p className="mt-1 italic text-muted-foreground">
                        „{r.note}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            // Single-group fall-through: no section header, ratings just
            // sit flat inside the card like before.
            <ul key={bucket.groupId} className="space-y-2">
              {bucket.ratings.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border bg-muted/20 p-3 text-sm"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{r.userDisplayName}</span>
                    <span className="flex items-center gap-1 tabular-nums text-primary">
                      <Star size={14} className="fill-current" />
                      {r.overall.toFixed(2)}
                    </span>
                  </div>
                  {r.note && (
                    <p className="mt-1 italic text-muted-foreground">
                      „{r.note}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ),
        )}
      </CardContent>
    </Card>
  );
}
