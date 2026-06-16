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

// Skip rendering/layout for off-screen rows — cheap windowing without a
// virtualizer (rule: rendering-content-visibility). `auto` remembers the
// last measured height; the fallback keeps the scrollbar roughly right
// before a row has been painted once.
const CV_STYLE = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 76px",
} as React.CSSProperties;

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
    <li
      style={CV_STYLE}
      className="flex items-start gap-3 rounded-2xl border bg-card p-3"
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
          {item.actorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.actorAvatarUrl}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            initials(item.actorName)
          )}
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-muted text-primary">
          <Icon size={11} strokeWidth={2} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{item.actorName}</span>{" "}
          {d.verb}
          {subject ? <> {subject}</> : null}
          {d.tail ? <> {d.tail}</> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {STAMP.format(item.createdAt)}
        </p>
      </div>
    </li>
  );
}
