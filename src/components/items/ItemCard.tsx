import Link from "next/link";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { StarRating } from "@/components/places/StarRating";
import type { ItemCard as ItemCardData } from "@/domain/items/service";

export function ItemCard({
  placeId,
  item,
}: {
  placeId: string;
  item: ItemCardData;
}) {
  return (
    <Link
      href={`/places/${placeId}/items/${item.id}`}
      className="group flex items-stretch gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/40"
    >
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt=""
          loading="lazy"
          className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted text-primary"
        >
          <UtensilsCrossed size={22} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="truncate font-display text-base leading-tight">
          {item.name}
        </p>
        {item.avgScore !== null ? (
          <div className="flex items-center gap-1.5 text-sm">
            <StarRating value={item.avgScore} />
            <span className="font-medium tabular-nums">
              {item.avgScore.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({item.ratingCount})
            </span>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            jeszcze bez oceny
          </p>
        )}
      </div>

      {item.yourScore !== null && (
        <span className="inline-flex h-7 flex-shrink-0 items-center gap-1 self-center rounded-full bg-primary/15 px-2.5 text-xs font-medium text-primary">
          ty: {item.yourScore.toFixed(1)}
        </span>
      )}
      <ChevronRight
        size={18}
        className="flex-shrink-0 self-center text-muted-foreground"
      />
    </Link>
  );
}
