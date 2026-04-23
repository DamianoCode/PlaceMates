"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, LayoutGrid, Plus } from "lucide-react";
import { MapViewClient } from "./MapViewClient";
import { PlacePreviewSheet } from "./PlacePreviewSheet";

type Category = { id: string; name: string; icon?: string };

export function MapScreen({
  categories,
  wishlistedIds,
  favoriteIds,
}: {
  categories: Category[];
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

  function resetFilters() {
    setCategoryFilter(null);
    setSetFilter("none");
  }

  return (
    <div className="relative h-[calc(100dvh-60px-env(safe-area-inset-bottom))] w-full">
      <MapViewClient
        categoryFilter={categoryFilter}
        restrictToIds={activeIdSet ?? undefined}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
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

      <Link
        href="/places/new"
        aria-label="Dodaj miejsce"
        className="absolute right-4 bottom-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus size={24} />
      </Link>
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
