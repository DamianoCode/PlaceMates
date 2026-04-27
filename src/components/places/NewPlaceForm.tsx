"use client";

import { useActionState, useEffect, useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";
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

type NearbyHit = {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
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
  const [categoryId, setCategoryId] = useState<string>("");
  const [nearby, setNearby] = useState<NearbyHit[]>([]);
  const [nearbyChecked, setNearbyChecked] = useState(false);
  const [dismissedNearby, setDismissedNearby] = useState(false);
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  // Pin-drop POI suggestion. When the user has dropped a pin AND chosen
  // a category, ask Overpass whether OSM already knows a POI at that
  // spot in the same category. If so, surface "Czy chodzi o…?" so they
  // can link the new place to the existing external canonical instead
  // of creating a fresh local one — keeps the global ranking from
  // fragmenting across pin-drops vs POI-search adds of the same place.
  useEffect(() => {
    if (mode !== "pin") return;
    if (!picked || picked.osmId) return; // already POI-backed
    if (!selectedCategory) return;
    if (dismissedNearby) return;
    let abort = false;
    const t = setTimeout(async () => {
      if (abort) return;
      try {
        const url = new URL("/api/poi/nearby", window.location.origin);
        url.searchParams.set("lat", String(picked.lat));
        url.searchParams.set("lng", String(picked.lng));
        url.searchParams.set("category", selectedCategory.slug);
        const res = await fetch(url);
        if (!res.ok) {
          if (!abort) {
            setNearby([]);
            setNearbyChecked(true);
          }
          return;
        }
        const data: { results: NearbyHit[] } = await res.json();
        if (!abort) {
          setNearby(data.results ?? []);
          setNearbyChecked(true);
        }
      } catch {
        if (!abort) setNearbyChecked(true);
      }
    }, 350);
    return () => {
      abort = true;
      clearTimeout(t);
    };
  }, [
    mode,
    picked,
    selectedCategory,
    dismissedNearby,
  ]);

  // Reset nearby when the user moves the pin or changes category — the
  // previous suggestions no longer apply. Defer with queueMicrotask so
  // the React-compiler set-state-in-effect rule is satisfied.
  useEffect(() => {
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      setNearbyChecked(false);
      setNearby([]);
      setDismissedNearby(false);
    });
    return () => {
      abort = true;
    };
  }, [picked?.lat, picked?.lng, categoryId]);

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
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
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

      {mode === "pin" &&
        picked &&
        !picked.osmId &&
        selectedCategory &&
        nearbyChecked &&
        nearby.length > 0 &&
        !dismissedNearby && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles size={16} className="text-primary" />W tej okolicy
              istnieje już:
            </p>
            <p className="text-xs text-muted-foreground">
              Wybierz, jeśli chodzi ci o jedno z tych miejsc — dodasz je
              wtedy do wspólnego rankingu razem z ocenami innych grup.
              W przeciwnym razie zostaw nowy pin.
            </p>
            <ul className="space-y-1">
              {nearby.map((n) => (
                <li key={n.osmId}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked({
                        name: n.name,
                        address: n.address ?? "",
                        lat: n.lat,
                        lng: n.lng,
                        osmId: n.osmId,
                      });
                      setNearby([]);
                      setNearbyChecked(true);
                    }}
                    className="w-full rounded-md bg-background px-3 py-2 text-left text-sm shadow-sm hover:bg-muted"
                  >
                    <div className="font-medium">{n.name}</div>
                    {n.address && (
                      <div className="truncate text-xs text-muted-foreground">
                        {n.address}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDismissedNearby(true)}
              className="text-xs italic text-muted-foreground underline-offset-2 hover:underline"
            >
              Żadne z powyższych — nowy pin
            </button>
          </div>
        )}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending || !picked}>
        {pending ? "Zapisuję…" : "Zapisz miejsce"}
      </Button>
    </form>
  );
}
