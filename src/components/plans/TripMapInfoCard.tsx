"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";
import { CategoryIcon } from "@/components/map/category-icons";
import { cn } from "@/lib/utils";
import { formatDistance, formatDuration } from "@/lib/format-route";
import type { TripStopView } from "@/domain/trips/service";

type RouteSegment = { distanceM: number; durationS: number };

/**
 * Floating info card overlaid at the bottom of the trip map. Shows
 * the currently selected stop (the one whose pin was tapped) with
 * prev/next navigation so the user can scrub through every stop
 * without leaving the map. Tapping the photo or name jumps to the
 * place's full detail.
 *
 * The card is dismissible — `[X]` clears the selection so the map
 * re-shows the whole route uncluttered. Reusing the visual language
 * of `PlacePreviewSheet` (rounded-2xl, backdrop-blur, photo-left
 * layout) keeps the trip map feeling cohesive with the main map.
 */
export function TripMapInfoCard({
  stops,
  selectedStopId,
  onSelect,
  onClose,
  segments,
}: {
  stops: TripStopView[];
  selectedStopId: string | null;
  onSelect: (stopId: string) => void;
  onClose: () => void;
  /** Per-stop-pair leg stats from ORS. segments[i] = stop i → i+1.
   *  Empty array when no route is available (single stop, ORS
   *  unreachable, profile didn't include segments yet). */
  segments: RouteSegment[];
}) {
  if (selectedStopId === null) return null;

  const idx = stops.findIndex((s) => s.id === selectedStopId);
  if (idx < 0) return null;

  const stop = stops[idx];
  const prev = idx > 0 ? stops[idx - 1] : null;
  const next = idx < stops.length - 1 ? stops[idx + 1] : null;
  const completed = stop.completedAt !== null;
  // Leg from prev stop to this one. segments[i-1] gives the route
  // arriving AT stop i (segment i-1 is from stop i-1 to stop i).
  const legFromPrev = prev && idx - 1 < segments.length ? segments[idx - 1] : null;

  return (
    <div
      role="dialog"
      aria-label="Podgląd stopu"
      className="pointer-events-none absolute inset-x-2 bottom-2 z-20 animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="pointer-events-auto overflow-hidden rounded-2xl border bg-background/95 shadow-xl backdrop-blur">
        <div className="flex items-stretch gap-3 p-3">
          {/* Photo / category fallback — same shape as
           *  PlacePreviewSheet so the visual rhyme carries across
           *  map contexts. */}
          {stop.placePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stop.placePhotoUrl}
              alt=""
              loading="lazy"
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 via-primary/5 to-muted"
            >
              <CategoryIcon
                slug={stop.placeCategorySlug}
                size={28}
                strokeWidth={1.5}
                className="text-primary/70"
              />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold tabular-nums shadow-sm",
                      completed
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {completed ? <Check size={12} /> : idx + 1}
                  </span>
                  <h2 className="truncate font-display text-base leading-tight">
                    {stop.placeName}
                  </h2>
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs italic text-muted-foreground">
                  <CategoryIcon
                    slug={stop.placeCategorySlug}
                    size={11}
                    aria-hidden
                  />
                  {stop.placeCategoryName}
                </p>
                {stop.plannedAtTime && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={11} aria-hidden />
                    <span className="font-mono tabular-nums">
                      {stop.plannedAtTime}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij podgląd"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {legFromPrev && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                <ArrowDownRight size={11} aria-hidden />
                <span>Od poprzedniego:</span>
                <span className="font-mono tabular-nums">
                  {formatDistance(legFromPrev.distanceM)}
                </span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">
                  {formatDuration(legFromPrev.durationS)}
                </span>
              </p>
            )}

            {stop.note && (
              <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                {stop.note}
              </p>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => prev && onSelect(prev.id)}
                  disabled={!prev}
                  aria-label="Poprzedni stop"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="min-w-[2.5rem] text-center font-mono text-xs tabular-nums text-muted-foreground/80">
                  {idx + 1} / {stops.length}
                </span>
                <button
                  type="button"
                  onClick={() => next && onSelect(next.id)}
                  disabled={!next}
                  aria-label="Następny stop"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <Link
                href={`/places/${stop.placeId}`}
                className="inline-flex h-11 flex-shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Szczegóły
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

