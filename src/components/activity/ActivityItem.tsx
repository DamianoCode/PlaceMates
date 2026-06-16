import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  MapPin,
  Route,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ActivityView } from "@/domain/activity/service";

/**
 * One line in the group activity feed. Pure presentational — the actor
 * avatar (or initials), a sentence describing what happened, and a
 * relative timestamp. The subject (place / trip) links to its detail page
 * when the referenced row still exists; after a delete `placeId`/`tripId`
 * go NULL and the snapshotted name renders as plain text.
 */

type Descriptor = {
  icon: LucideIcon;
  /** Gendered Polish verb phrase, "(a)" suffix like the push copy. */
  verb: string;
  subject: string | null;
  /** Trailing clause after the subject (e.g. "w planie X"). */
  tail?: string | null;
  href: string | null;
};

function describe(item: ActivityView): Descriptor {
  const { metadata: m, placeId, tripId } = item;
  const placeHref = placeId ? `/places/${placeId}` : null;
  const tripHref = tripId ? `/plans/${tripId}` : null;

  switch (item.type) {
    case "place_added":
      return {
        icon: MapPin,
        verb: "dodał(a) miejsce",
        subject: m.placeName ?? "miejsce",
        href: placeHref,
      };
    case "rating_added":
      return {
        icon: Star,
        verb: "ocenił(a)",
        subject: m.placeName ?? "miejsce",
        tail:
          typeof m.overall === "number" ? `na ${m.overall.toFixed(2)}` : null,
        href: placeHref,
      };
    case "photo_added":
      return {
        icon: Camera,
        verb: "dodał(a) zdjęcie do",
        subject: m.placeName ?? "miejsca",
        href: placeHref,
      };
    case "trip_created":
      return {
        icon: Route,
        verb: "zaplanował(a) wyprawę",
        subject: m.tripName ?? "wyprawę",
        href: tripHref,
      };
    case "trip_completed":
      return {
        icon: CheckCircle2,
        verb: "odhaczył(a)",
        subject: m.placeName ?? "stop",
        tail: m.tripName ? `w planie „${m.tripName}”` : null,
        href: tripHref,
      };
    case "member_joined":
      return {
        icon: UserPlus,
        verb: "dołączył(a) do grupy",
        subject: null,
        href: null,
      };
  }
}

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

// Absolute, deterministic timestamp — matches the date style used across
// the app (MemberRow etc.) and stays pure (no Date.now() in render, so no
// hydration drift and no purity-lint violation).
const STAMP = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function ActivityItem({ item }: { item: ActivityView }) {
  const d = describe(item);
  const Icon = d.icon;

  const subject = d.subject ? (
    d.href ? (
      <Link
        href={d.href}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {d.subject}
      </Link>
    ) : (
      <span className="font-medium text-foreground">{d.subject}</span>
    )
  ) : null;

  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      {/* Avatar — clean circle, no overlay. The type is conveyed by the
       *  verb text plus the inline icon on the meta line below, so we
       *  avoid the fragile absolutely-positioned corner badge entirely. */}
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {item.actorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.actorAvatarUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          initials(item.actorName)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{item.actorName}</span>{" "}
          {d.verb}
          {subject ? <> {subject}</> : null}
          {d.tail ? <> {d.tail}</> : null}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/80">
          <Icon
            size={13}
            strokeWidth={2}
            className="flex-shrink-0 text-primary/70"
            aria-hidden
          />
          <span className="tabular-nums">{STAMP.format(item.createdAt)}</span>
        </p>
      </div>
    </li>
  );
}
