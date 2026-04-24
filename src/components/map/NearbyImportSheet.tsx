"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bulkImportAction } from "@/app/(app)/places/import-actions";

export type ImportCategory = { id: string; slug: string; name: string };

type Poi = {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
};

/**
 * Bottom sheet that queries Overpass for nearby POIs of a selected
 * category (inside the current map bbox) and lets the user bulk-import
 * a subset. Only categories with an OSM mapping are shown.
 */
export function NearbyImportSheet({
  open,
  onClose,
  groupId,
  categories,
  getBbox,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  categories: ImportCategory[];
  /** Reads the current map viewport lazily so we don't couple to view state. */
  getBbox: () => { west: number; south: number; east: number; north: number } | null;
}) {
  const [selectedCat, setSelectedCat] = useState<ImportCategory | null>(null);
  const [results, setResults] = useState<Poi[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;
    // Reset asynchronously so we don't setState synchronously inside an effect.
    const t = queueMicrotask(() => {
      setSelectedCat(null);
      setResults([]);
      setChecked(new Set());
    });
    return () => {
      void t;
    };
  }, [open]);

  async function runSearch(cat: ImportCategory) {
    const bbox = getBbox();
    if (!bbox) {
      toast.error("Nie udało się odczytać obszaru mapy.");
      return;
    }
    setSelectedCat(cat);
    setLoading(true);
    setResults([]);
    setChecked(new Set());
    try {
      const bboxParam = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const res = await fetch(
        `/api/nearby?category=${encodeURIComponent(cat.slug)}&bbox=${bboxParam}`,
      );
      if (!res.ok) {
        if (res.status === 400) toast.error("Obszar mapy jest zbyt duży.");
        else toast.error("Nie udało się pobrać miejsc.");
        return;
      }
      const data = (await res.json()) as { results: Poi[] };
      setResults(data.results);
      // Pre-check all so the default action is "import everything".
      setChecked(new Set(data.results.map((r) => r.osmId)));
    } catch {
      toast.error("Błąd sieci.");
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    if (!selectedCat || checked.size === 0) return;
    const items = results
      .filter((r) => checked.has(r.osmId))
      .map((r) => ({
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        address: r.address,
        osmId: r.osmId,
      }));
    setSubmitting(true);
    const result = await bulkImportAction({
      groupId,
      categoryId: selectedCat.id,
      items,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Dodano ${result.inserted} miejsc${
        result.skipped > 0 ? ` · pominięto ${result.skipped} już dodanych` : ""
      }.`,
    );
    onClose();
  }

  if (!open) return null;

  const allChecked = results.length > 0 && checked.size === results.length;

  return (
    <div
      role="dialog"
      aria-label="Znajdź w okolicy"
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-t-3xl border-t border-x bg-background shadow-2xl animate-in slide-in-from-bottom-6 duration-200"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl leading-tight">Znajdź w okolicy</h2>
            <p className="text-xs italic text-muted-foreground">
              {selectedCat
                ? `Miejsca z OpenStreetMap — kategoria: ${selectedCat.name}`
                : "Wybierz kategorię"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {!selectedCat && (
          <ul className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-auto p-4 sm:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => runSearch(c)}
                  className="flex h-16 w-full items-center justify-center rounded-2xl border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedCat && (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <button
                type="button"
                onClick={() => setSelectedCat(null)}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                ← inna kategoria
              </button>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setChecked(
                      allChecked ? new Set() : new Set(results.map((r) => r.osmId)),
                    )
                  }
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {allChecked ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                </button>
              )}
            </div>

            <ul className="max-h-[55vh] divide-y overflow-auto">
              {loading && (
                <li className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Szukam…
                </li>
              )}
              {!loading && results.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  Nic nie znaleziono w widocznym obszarze. Przesuń mapę i spróbuj ponownie.
                </li>
              )}
              {results.map((r) => {
                const isChecked = checked.has(r.osmId);
                return (
                  <li key={r.osmId}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(checked);
                        if (isChecked) next.delete(r.osmId);
                        else next.add(r.osmId);
                        setChecked(next);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        isChecked ? "bg-primary/10" : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border",
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                        aria-hidden
                      >
                        {isChecked && <Check size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        {r.address && (
                          <p className="truncate text-xs text-muted-foreground">
                            {r.address}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {checked.size === 0
                  ? "Nic niewybrane."
                  : `Wybrano ${checked.size} z ${results.length}.`}
              </p>
              <button
                type="button"
                disabled={submitting || checked.size === 0}
                onClick={doImport}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Dodaj wybrane
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
