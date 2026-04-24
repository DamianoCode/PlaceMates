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
} from "lucide-react";
import { MapViewClient } from "./MapViewClient";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import { SpeedDial, type SpeedDialAction } from "./SpeedDial";
import { NearbyImportSheet } from "./NearbyImportSheet";

type Category = { id: string; slug: string; name: string };
type Bbox = { west: number; south: number; east: number; north: number };
type PlacePin = { id: string; name: string; lat: number; lng: number; categoryId: string };

export function MapScreen({
  primaryGroupId,
  categories,
  places,
  wishlistedIds,
  favoriteIds,
}: {
  primaryGroupId: string | null;
  categories: Category[];
  places: PlacePin[];
  wishlistedIds: string[];
  favoriteIds: string[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [setFilter, setSetFilter] = useState<"none" | "wishlist" | "favorites">(
    "none",
  );
  const wishSet = new Set(wishlistedIds);
  const favSet = new Set(favoriteIds);
  const activeIdSet =
    setFilter === "wishlist"
      ? wishSet
      : setFilter === "favorites"
        ? favSet
        : null;

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
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
        categoryFilter={categoryFilter}
        restrictToIds={activeIdSet ?? undefined}
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

      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-2">
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
          <span className="mx-0.5 h-5 w-px flex-shrink-0 bg-border" aria-hidden />
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => {
                setCategoryFilter(categoryFilter === c.id ? null : c.id);
                setSetFilter("none");
              }}
            >
              {c.name}
            </FilterPill>
          ))}
        </div>
      </div>

      <PlacePreviewSheet
        placeId={selectedPlaceId}
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
    "inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? `${base} bg-primary text-primary-foreground`
          : `${base} text-muted-foreground hover:bg-muted hover:text-foreground`
      }
    >
      {icon}
      {children}
    </button>
  );
}
