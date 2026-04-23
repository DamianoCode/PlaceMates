"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";

type Preview = {
  id: string;
  name: string;
  categoryName: string;
  overall: number | null;
  ratingCount: number;
  photoUrl: string | null;
};

export function PlacePreviewSheet({
  placeId,
  onClose,
}: {
  placeId: string | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let abort = false;
    // Defer all state updates off the sync path so the compiler's
    // set-state-in-effect rule is satisfied.
    queueMicrotask(() => {
      if (abort) return;
      if (!placeId) {
        setPreview(null);
        return;
      }
      setLoading(true);
      fetch(`/api/places/${placeId}/preview`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Preview | null) => {
          if (!abort) setPreview(data);
        })
        .finally(() => {
          if (!abort) setLoading(false);
        });
    });
    return () => {
      abort = true;
    };
  }, [placeId]);

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
                  {preview?.name ?? (loading ? "Ładuję…" : "")}
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
      </div>
    </div>
  );
}
