"use client";

import { useActionState, useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapViewClient } from "@/components/map/MapViewClient";
import { createPlaceAction, type CreatePlaceState } from "@/app/(app)/places/actions";

type PoiHit = {
  osmId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryHint: string;
};

type Category = { id: string; slug: string; name: string };
type Group = { id: string; name: string };

type Mode = "search" | "pin";

export function NewPlaceForm({
  categories,
  groups,
  initialPick,
}: {
  categories: Category[];
  groups: Group[];
  /** Pre-selected lat/lng — forces the form to open in "pin" mode. */
  initialPick?: { lat: number; lng: number };
}) {
  const [state, action, pending] = useActionState<CreatePlaceState, FormData>(
    createPlaceAction,
    null,
  );
  const [mode, setMode] = useState<Mode>(initialPick ? "pin" : "search");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PoiHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    osmId?: string;
  } | null>(
    initialPick ? { name: "", address: "", lat: initialPick.lat, lng: initialPick.lng } : null,
  );

  // Debounced POI search. All setState calls happen inside the debounce
  // timer (async) to avoid cascading-render warnings.
  useEffect(() => {
    if (mode !== "search") return;
    const q = query.trim();
    let abort = false;
    const t = setTimeout(async () => {
      if (abort) return;
      if (q.length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/poi/search?q=${encodeURIComponent(q)}`);
        const data: { results: PoiHit[] } = await res.json();
        if (!abort) setHits(data.results ?? []);
      } finally {
        if (!abort) setSearching(false);
      }
    }, 400);
    return () => {
      abort = true;
      clearTimeout(t);
    };
  }, [query, mode]);

  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="groupId" value={groups[0]?.id ?? ""} />
      {picked && (
        <>
          <input type="hidden" name="lat" value={picked.lat} />
          <input type="hidden" name="lng" value={picked.lng} />
          <input type="hidden" name="address" value={picked.address} />
          {picked.osmId ? <input type="hidden" name="osmId" value={picked.osmId} /> : null}
        </>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Sposób wyboru miejsca">
        <Button
          type="button"
          variant={mode === "search" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("search")}
          role="tab"
          aria-selected={mode === "search"}
        >
          <Search size={16} className="mr-2" /> Szukaj
        </Button>
        <Button
          type="button"
          variant={mode === "pin" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("pin")}
          role="tab"
          aria-selected={mode === "pin"}
        >
          <MapPin size={16} className="mr-2" /> Pin na mapie
        </Button>
      </div>

      {mode === "search" && (
        <div className="space-y-2">
          <Label htmlFor="poi">Szukaj miejsca</Label>
          <Input
            id="poi"
            type="search"
            placeholder="np. lodziarnia Stara Miłosna"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {searching && <p className="text-xs text-muted-foreground">Szukam…</p>}
          {hits.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-auto rounded-md border p-1">
              {hits.map((h) => (
                <li key={h.osmId}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked({
                        name: h.name,
                        address: h.address,
                        lat: h.lat,
                        lng: h.lng,
                        osmId: h.osmId,
                      });
                    }}
                    className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <div className="font-medium">{h.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{h.address}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "pin" && (
        <div className="space-y-2">
          <Label>Wybierz punkt na mapie</Label>
          <div className="h-64 overflow-hidden rounded-md border">
            <MapViewClient
              initial={
                picked
                  ? { longitude: picked.lng, latitude: picked.lat, zoom: 15 }
                  : undefined
              }
              initialPick={picked ? { lat: picked.lat, lng: picked.lng } : undefined}
              onPick={({ lng, lat }) =>
                setPicked((prev) => ({
                  name: prev?.name ?? "",
                  address: prev?.address ?? "",
                  lat,
                  lng,
                }))
              }
            />
          </div>
          {picked && (
            <p className="text-xs text-muted-foreground">
              Wybrano: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nazwa</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={picked?.name ?? ""}
          key={picked?.name ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Kategoria</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className="field-base h-11"
        >
          <option value="" disabled>
            Wybierz kategorię…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending || !picked}>
        {pending ? "Zapisuję…" : "Zapisz miejsce"}
      </Button>
    </form>
  );
}
