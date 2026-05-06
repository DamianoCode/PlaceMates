"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { MapPin, Pin, Search, Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapViewClient } from "@/components/map/MapViewClient";
import { loadCamera } from "@/components/map/camera-storage";
import { createPlaceAction, type CreatePlaceState } from "@/app/(app)/places/actions";
import { fetchJson } from "@/lib/fetch-json";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type PoiHit = {
  provider: "osm" | "geoapify";
  externalId: string;
  /** Legacy alias — equals externalId when provider is osm, "" otherwise. */
  osmId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryHint: string;
};

type NearbyHit = {
  // Overpass nearby always returns OSM ids; keep a narrow shape.
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  categoryHint: string;
  address: string | null;
};

type Category = { id: string; slug: string; name: string };
type Group = { id: string; name: string; categories: Category[] };

type Mode = "search" | "pin";

export function NewPlaceForm({
  groups,
  initialPick,
}: {
  /** Each group carries its own category list. Categories may differ
   *  across groups (per-group + globals), so swapping groups swaps the
   *  category dropdown's options. */
  groups: Group[];
  /** Pre-selected lat/lng — forces the form to open in "pin" mode. */
  initialPick?: { lat: number; lng: number };
}) {
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const selectedGroup = groups.find((g) => g.id === groupId) ?? groups[0];
  // Memoised so the category-reset effect doesn't see a fresh array on
  // every render and re-trigger needlessly.
  const categories = useMemo(
    () => selectedGroup?.categories ?? [],
    [selectedGroup],
  );
  const [state, action, pending] = useActionState<CreatePlaceState, FormData>(
    createPlaceAction,
    null,
  );
  const [mode, setMode] = useState<Mode>(initialPick ? "pin" : "search");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    /** External provider when this place came from a search; absent for pin-drops. */
    provider?: "osm" | "geoapify";
    externalId?: string;
    /** Legacy alias for the createPlace form field — only set when provider==='osm'. */
    osmId?: string;
  } | null>(
    initialPick ? { name: "", address: "", lat: initialPick.lat, lng: initialPick.lng } : null,
  );
  const [categoryId, setCategoryId] = useState<string>("");
  const [dismissedNearby, setDismissedNearby] = useState(false);
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  // Group switch invalidates the current category pick — the new
  // group's list may not contain it. Defer with queueMicrotask to
  // satisfy react-compiler's set-state-in-effect rule.
  useEffect(() => {
    if (!categoryId) return;
    if (categories.some((c) => c.id === categoryId)) return;
    let abort = false;
    queueMicrotask(() => {
      if (!abort) setCategoryId("");
    });
    return () => {
      abort = true;
    };
  }, [categories, categoryId]);

  // Stash the user's last map camera once on mount and use it as a
  // proximity hint for the search API. Without this Photon/Geoapify
  // rank globally and small-town queries drown under capital hits.
  // Initial pick (e.g. "Dodaj tutaj") wins as a more accurate signal.
  const [bias] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialPick) return { lat: initialPick.lat, lng: initialPick.lng };
    const cam = loadCamera();
    return cam ? { lat: cam.latitude, lng: cam.longitude } : null;
  });
  const biasKey = bias
    ? `${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}`
    : null;

  // Debounced query keeps the search useQuery from spawning a new
  // request on every keystroke; debouncedQuery is what feeds the key.
  const debouncedQuery = useDebouncedValue(query.trim(), 400);
  const searchEnabled = mode === "search" && debouncedQuery.length >= 2;
  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ["poi-search", debouncedQuery, biasKey],
    enabled: searchEnabled,
    queryFn: () => {
      const url = new URL("/api/poi/search", window.location.origin);
      url.searchParams.set("q", debouncedQuery);
      if (bias) {
        url.searchParams.set("lat", String(bias.lat));
        url.searchParams.set("lng", String(bias.lng));
      }
      return fetchJson<{ results: PoiHit[] }>(url.toString());
    },
    staleTime: 5 * 60_000,
  });
  const hits = searchEnabled ? searchData?.results ?? [] : [];

  // Pin-drop POI suggestion. When the user has dropped a pin AND chosen
  // a category, ask Overpass whether OSM already knows a POI at that
  // spot in the same category. If so, surface "Czy chodzi o…?" so they
  // can link the new place to the existing external canonical instead
  // of creating a fresh local one — keeps the global ranking from
  // fragmenting across pin-drops vs POI-search adds of the same place.
  const nearbyEnabled =
    mode === "pin" &&
    !!picked &&
    !picked.osmId &&
    !!selectedCategory &&
    !dismissedNearby;
  const { data: nearbyData, isSuccess: nearbyChecked } = useQuery({
    queryKey: [
      "poi-nearby",
      picked?.lat,
      picked?.lng,
      selectedCategory?.slug ?? null,
    ],
    enabled: nearbyEnabled,
    queryFn: () => {
      const url = new URL("/api/poi/nearby", window.location.origin);
      url.searchParams.set("lat", String(picked!.lat));
      url.searchParams.set("lng", String(picked!.lng));
      url.searchParams.set("category", selectedCategory!.slug);
      return fetchJson<{ results: NearbyHit[] }>(url.toString());
    },
    staleTime: 5 * 60_000,
  });
  const nearby = nearbyEnabled ? nearbyData?.results ?? [] : [];

  // Reset the dismiss flag when the user moves the pin or changes
  // category — the previous suggestion no longer applies. Defer with
  // queueMicrotask so the React-compiler set-state-in-effect rule is
  // satisfied.
  useEffect(() => {
    let abort = false;
    queueMicrotask(() => {
      if (!abort) setDismissedNearby(false);
    });
    return () => {
      abort = true;
    };
  }, [picked?.lat, picked?.lng, categoryId]);

  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="groupId" value={groupId} />
      {picked && (
        <>
          <input type="hidden" name="lat" value={picked.lat} />
          <input type="hidden" name="lng" value={picked.lng} />
          <input type="hidden" name="address" value={picked.address} />
          {picked.provider && picked.externalId ? (
            <>
              <input type="hidden" name="provider" value={picked.provider} />
              <input
                type="hidden"
                name="externalId"
                value={picked.externalId}
              />
              {/* Keep `osmId` filled too so any caller still reading it
                  (bulk dedupe, edit-place legacy code) keeps working. */}
              {picked.provider === "osm" && (
                <input type="hidden" name="osmId" value={picked.externalId} />
              )}
            </>
          ) : null}
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
            // type="text" + role keeps the searchbox semantics without
            // the duplicate native clear "X" that type="search" injects.
            type="text"
            role="searchbox"
            placeholder="np. lodziarnia Stara Miłosna"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {searching && <p className="text-xs text-muted-foreground">Szukam…</p>}
          {/* Hide the result list once the user has picked one — the
           *  PickedLocationSummary below carries the visual confirmation
           *  forward, so the list isn't earning its space anymore. The
           *  user can hit "Zmień" on the summary to re-open search. */}
          {!picked?.externalId && hits.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-auto rounded-md border p-1">
              {hits.map((h) => (
                <li key={`${h.provider}:${h.externalId}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked({
                        name: h.name,
                        address: h.address,
                        lat: h.lat,
                        lng: h.lng,
                        provider: h.provider,
                        externalId: h.externalId,
                        osmId: h.provider === "osm" ? h.externalId : undefined,
                      });
                      // Clear the query so the list collapses cleanly.
                      // The picked card takes over.
                      setQuery("");
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
        </div>
      )}

      {picked && (
        <PickedLocationSummary
          picked={picked}
          onClear={() => {
            setPicked(null);
            setDismissedNearby(false);
          }}
        />
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

      {/* Group picker only shows for multi-group users. Single-group
       *  flow stays UI-identical to the previous version — the hidden
       *  groupId input above carries the same value as before. */}
      {groups.length >= 2 && (
        <div className="space-y-2">
          <Label htmlFor="groupSelect">Grupa</Label>
          <select
            id="groupSelect"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="field-base h-11"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Miejsce pojawi się na mapie tej grupy i tylko jej członkowie
            zobaczą oceny.
          </p>
        </div>
      )}

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
                        provider: "osm",
                        externalId: n.osmId,
                        osmId: n.osmId,
                      });
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

/**
 * Persistent confirmation of the location the user picked. Lives between
 * the mode panel and the Name input so editing the name never loses the
 * "what did I select again?" answer. The original POI name is shown
 * even if the user has since edited the Name input — this stays read-only
 * until they explicitly clear with "Zmień".
 */
function PickedLocationSummary({
  picked,
  onClear,
}: {
  picked: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    provider?: "osm" | "geoapify";
    externalId?: string;
  };
  onClear: () => void;
}) {
  const fromSearch = !!picked.externalId;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          {fromSearch ? <MapPin size={14} /> : <Pin size={14} />}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary/80">
            {fromSearch ? "Wybrana lokalizacja" : "Pin na mapie"}
          </p>
          {fromSearch && picked.name ? (
            <p className="text-sm font-medium leading-tight">{picked.name}</p>
          ) : null}
          {picked.address ? (
            <p className="text-xs leading-snug text-muted-foreground">
              {picked.address}
            </p>
          ) : null}
          <p className="font-mono text-[10px] tabular-nums text-muted-foreground/80">
            {picked.lat.toFixed(5)}°N · {picked.lng.toFixed(5)}°E
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Wyczyść wybór lokalizacji"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
