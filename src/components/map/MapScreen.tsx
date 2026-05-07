"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bookmark,
  Heart,
  LayoutGrid,
  Locate,
  MapPin,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { MapViewClient } from "./MapViewClient";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import { SpeedDial, type SpeedDialAction } from "./SpeedDial";
import { NearbyImportSheet } from "./NearbyImportSheet";
import type { PlaceMarker } from "@/domain/places/service";

type Category = { id: string; slug: string; name: string };
type Bbox = { west: number; south: number; east: number; north: number };
type PlacePin = PlaceMarker;
type GroupWishlistGroup = {
  id: string;
  name: string;
  placeIds: string[];
};

export function MapScreen({
  primaryGroupId,
  categories,
  places,
  wishlistedIds,
  favoriteIds,
  groupWishlistByGroup,
  focus,
}: {
  primaryGroupId: string | null;
  categories: Category[];
  places: PlacePin[];
  wishlistedIds: string[];
  favoriteIds: string[];
  /**
   * Per-group breakdown of group-wishlist place ids. Drives the
   * "Grupowo" pill (union across all entries) and — when the user has
   * ≥2 groups with anything wishlisted — the per-group narrow row.
   */
  groupWishlistByGroup: GroupWishlistGroup[];
  /**
   * Optional initial camera + selection driven by ?lat=&lng=&zoom=&place=
   * deeplink. When present we open the map centred on the place and
   * auto-pop the preview sheet so it's clear which marker we landed on.
   */
  focus?: { lat: number; lng: number; zoom: number; placeId: string | null } | null;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [setFilter, setSetFilter] = useState<
    "none" | "wishlist" | "favorites" | "group-wishlist"
  >("none");
  // Active narrow within the group-wishlist set — null = union across
  // all user's groups. Cleared whenever the set leaves "group-wishlist".
  const [groupWishlistGroupId, setGroupWishlistGroupId] = useState<
    string | null
  >(null);

  const wishSet = useMemo(() => new Set(wishlistedIds), [wishlistedIds]);
  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const groupWishUnion = useMemo(() => {
    const u = new Set<string>();
    for (const g of groupWishlistByGroup) {
      for (const id of g.placeIds) u.add(id);
    }
    return u;
  }, [groupWishlistByGroup]);
  const groupWishByGroupSet = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const g of groupWishlistByGroup) {
      m.set(g.id, new Set(g.placeIds));
    }
    return m;
  }, [groupWishlistByGroup]);

  const activeIdSet =
    setFilter === "wishlist"
      ? wishSet
      : setFilter === "favorites"
        ? favSet
        : setFilter === "group-wishlist"
          ? (groupWishlistGroupId
              ? (groupWishByGroupSet.get(groupWishlistGroupId) ?? new Set<string>())
              : groupWishUnion)
          : null;

  // Seed selection from a focus deeplink so the preview sheet pops
  // immediately on landing — saves the user a tap.
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    focus?.placeId ?? null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const bboxRef = useRef<Bbox | null>(null);
  const router = useRouter();

  const handleBoundsChange = useCallback((b: Bbox) => {
    bboxRef.current = b;
  }, []);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, { slug: c.slug }])),
    [categories],
  );

  function resetFilters() {
    setCategoryFilter(null);
    setSetFilter("none");
    setGroupWishlistGroupId(null);
  }

  function addHere() {
    if (!("geolocation" in navigator)) {
      router.push("/places/new");
      return;
    }
    const toastId = toast.loading("Odczytuję lokalizację…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(toastId);
        const { latitude, longitude } = pos.coords;
        router.push(
          `/places/new?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`,
        );
      },
      () => {
        toast.dismiss(toastId);
        toast.error("Nie udało się odczytać lokalizacji.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const speedDialActions: SpeedDialAction[] = [
    {
      id: "add-search",
      label: "Dodaj miejsce",
      icon: <MapPin size={20} />,
      onClick: () => router.push("/places/new"),
    },
    {
      id: "add-here",
      label: "Dodaj tutaj",
      icon: <Locate size={20} />,
      onClick: addHere,
    },
    {
      id: "import-nearby",
      label: "Znajdź w okolicy",
      icon: <Sparkles size={20} />,
      onClick: () => {
        if (!primaryGroupId) {
          toast.error("Najpierw dołącz do grupy.");
          return;
        }
        setImportOpen(true);
      },
    },
    {
      id: "groups",
      label: "Twoje grupy",
      icon: <UserPlus size={20} />,
      onClick: () => router.push("/me"),
    },
  ];

  return (
    <div className="relative h-[calc(100dvh-60px-env(safe-area-inset-bottom))] w-full">
      <MapViewClient
        // Deeplink-driven camera wins over the persisted last-camera.
        // MapView still falls back to localStorage when initial is empty.
        initial={
          focus
            ? {
                latitude: focus.lat,
                longitude: focus.lng,
                zoom: focus.zoom,
              }
            : undefined
        }
        categoryFilter={categoryFilter}
        restrictToIds={activeIdSet ?? undefined}
        // Per-pin colour drivers — fav pins go rose, wishlist pins go
        // emerald, group-wishlist pins go sky, others stay on brand.
        // Reusing the same sets we already build for the set-filter
        // so MapView doesn't have to re-derive them.
        favoriteIdSet={favSet}
        wishlistedIdSet={wishSet}
        groupWishlistedIdSet={groupWishUnion}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
        onBoundsChange={handleBoundsChange}
        categoriesById={categoriesById}
        places={places}
        onContextMenu={({ lng, lat }) => {
          router.push(
            `/places/new?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,
          );
        }}
      />

      {/* Pills sit above the map, but on iOS PWA the system status bar
       *  paints over the top of the viewport. Push by safe-area-inset-top
       *  so the pills clear the notch + clock area; +0.5rem keeps the
       *  same breathing room as before on devices without an inset. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-10 flex flex-col gap-1.5 px-2">
        <div className="pointer-events-auto mx-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border/50 bg-background/90 p-1 shadow-md backdrop-blur no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]">
          <FilterPill
            active={!categoryFilter && setFilter === "none"}
            onClick={resetFilters}
            icon={<LayoutGrid size={14} />}
          >
            Wszystkie
          </FilterPill>
          <FilterPill
            active={setFilter === "favorites"}
            onClick={() => {
              setCategoryFilter(null);
              setGroupWishlistGroupId(null);
              setSetFilter(setFilter === "favorites" ? "none" : "favorites");
            }}
            icon={
              <Heart
                size={14}
                fill={setFilter === "favorites" ? "currentColor" : "none"}
              />
            }
          >
            Ulubione
          </FilterPill>
          <FilterPill
            active={setFilter === "wishlist"}
            onClick={() => {
              setCategoryFilter(null);
              setGroupWishlistGroupId(null);
              setSetFilter(setFilter === "wishlist" ? "none" : "wishlist");
            }}
            icon={
              <Bookmark
                size={14}
                fill={setFilter === "wishlist" ? "currentColor" : "none"}
              />
            }
          >
            Do odwiedzenia
          </FilterPill>
          <FilterPill
            active={setFilter === "group-wishlist"}
            onClick={() => {
              setCategoryFilter(null);
              // Toggling the pill off should also forget the per-group
              // narrow — otherwise re-toggling would silently re-apply it.
              setGroupWishlistGroupId(null);
              setSetFilter(
                setFilter === "group-wishlist" ? "none" : "group-wishlist",
              );
            }}
            icon={<Users size={14} />}
          >
            Grupowo
          </FilterPill>
          <span className="mx-0.5 h-5 w-px flex-shrink-0 bg-border" aria-hidden />
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => {
                setCategoryFilter(categoryFilter === c.id ? null : c.id);
                setSetFilter("none");
                setGroupWishlistGroupId(null);
              }}
            >
              {c.name}
            </FilterPill>
          ))}
        </div>

        {/* Per-group narrow only renders when the group-wishlist set is
         *  active AND there are ≥2 groups with anything wishlisted. Solo-
         *  group users see exactly the same UI as before. */}
        {setFilter === "group-wishlist" && groupWishlistByGroup.length >= 2 && (
          <div className="pointer-events-auto mx-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border/50 bg-background/90 p-1 shadow-md backdrop-blur no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]">
            <FilterPill
              active={!groupWishlistGroupId}
              onClick={() => setGroupWishlistGroupId(null)}
            >
              Wszystkie grupy
            </FilterPill>
            {groupWishlistByGroup.map((g) => (
              <FilterPill
                key={g.id}
                active={groupWishlistGroupId === g.id}
                onClick={() =>
                  setGroupWishlistGroupId(
                    groupWishlistGroupId === g.id ? null : g.id,
                  )
                }
              >
                {g.name}
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      <PlacePreviewSheet
        placeId={selectedPlaceId}
        // Chip is only meaningful for multi-group users — for a solo
        // group it'd be pure noise on every preview. Detection uses
        // distinct groupIds across the loaded markers (cheaper and more
        // accurate than passing user.groups separately, since the user
        // may belong to a group that has zero places yet).
        showGroupChip={
          new Set(places.map((p) => p.groupId)).size >= 2
        }
        // Initial preview lifted from the marker the user just tapped
        // — sheet renders synchronously with name / category / group /
        // overall / photo, no spinner. The query then fills in
        // groupBreakdown in the background for the rare multi-group
        // canonical.
        initialPreview={
          selectedPlaceId
            ? (() => {
                const m = places.find((p) => p.id === selectedPlaceId);
                if (!m) return null;
                return {
                  id: m.id,
                  name: m.name,
                  categoryName: m.categoryName,
                  groupId: m.groupId,
                  groupName: m.groupName,
                  overall: m.overall,
                  ratingCount: m.ratingCount,
                  photoUrl: m.photoUrl,
                };
              })()
            : null
        }
        onClose={() => setSelectedPlaceId(null)}
      />

      {/* Hide while the preview sheet is open so its Szczegóły CTA
       *  isn't overlapped by the FAB. */}
      {!selectedPlaceId && (
        <SpeedDial actions={speedDialActions} ariaLabel="Dodaj do mapy" />
      )}

      {primaryGroupId && (
        <NearbyImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          groupId={primaryGroupId}
          categories={categories}
          getBbox={() => bboxRef.current}
        />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? `${base} bg-primary text-primary-foreground shadow-sm shadow-primary/30`
          : `${base} text-muted-foreground hover:bg-muted hover:text-foreground`
      }
    >
      {icon}
      {children}
    </button>
  );
}
