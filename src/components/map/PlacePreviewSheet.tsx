"use client";

import Link from "next/link";
import { Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, HttpError } from "@/lib/fetch-json";

type GroupBreakdownEntry = {
  placeId: string;
  groupName: string;
  avg: number | null;
  count: number;
};

type Preview = {
  id: string;
  name: string;
  categoryName: string;
  overall: number | null;
  ratingCount: number;
  photoUrl: string | null;
  groupBreakdown: GroupBreakdownEntry[] | null;
};

/**
 * Subset of the preview the parent already has from the marker —
 * everything needed to render the sheet header without waiting for a
 * round-trip. `groupBreakdown` is intentionally NOT here because it
 * lives on the canonical-shared-across-groups path that the marker
 * SQL doesn't (and shouldn't) compute eagerly.
 */
export type InitialPreview = Omit<Preview, "groupBreakdown">;

export function PlacePreviewSheet({
  placeId,
  initialPreview,
  onClose,
}: {
  placeId: string | null;
  initialPreview?: InitialPreview | null;
  onClose: () => void;
}) {
  // The marker payload already covers everything the user sees on
  // first paint. We feed it as `placeholderData` so the sheet renders
  // synchronously, then the query fills in `groupBreakdown` (and any
  // server-side updates) once it lands.
  const placeholder: Preview | undefined = initialPreview
    ? { ...initialPreview, groupBreakdown: null }
    : undefined;

  const { data: preview } = useQuery({
    queryKey: ["place-preview", placeId],
    enabled: placeId !== null,
    placeholderData: placeholder,
    queryFn: async () => {
      if (!placeId) return null;
      try {
        return await fetchJson<Preview>(`/api/places/${placeId}/preview`);
      } catch (err) {
        // 404 = the place was deleted between the marker render and
        // the sheet open. Treat as "no preview" instead of error.
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
  });

  if (!placeId) return null;

  return (
    <div
      role="dialog"
      aria-label="Podgląd miejsca"
      className="pointer-events-auto absolute inset-x-2 bottom-2 z-20 animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-xl backdrop-blur">
        <div className="flex items-stretch gap-3 p-3">
          {preview?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.photoUrl}
              alt=""
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              Bez zdjęcia
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">
                  {preview?.name ?? ""}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {preview?.categoryName ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-auto flex items-center justify-between pt-2">
              <div className="flex items-center gap-1 text-sm">
                <Star size={14} className="fill-amber-400 stroke-amber-500" />
                {preview?.overall !== null && preview?.overall !== undefined ? (
                  <>
                    <span className="font-medium tabular-nums">
                      {preview.overall.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({preview.ratingCount})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">brak ocen</span>
                )}
              </div>

              {preview && (
                <Link
                  href={`/places/${preview.id}`}
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Szczegóły
                </Link>
              )}
            </div>
          </div>
        </div>

        {preview?.groupBreakdown && preview.groupBreakdown.length > 1 && (
          <ul className="border-t border-border/60 divide-y divide-border/40 bg-muted/30">
            {preview.groupBreakdown.map((b) => (
              <li
                key={b.placeId}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <span className="truncate text-muted-foreground">
                  W „{b.groupName}”
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  {b.avg !== null ? (
                    <>
                      <Star size={11} className="fill-amber-400 stroke-amber-500" />
                      <span className="font-medium">{b.avg.toFixed(2)}</span>
                      <span className="text-muted-foreground">({b.count})</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">brak ocen</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
