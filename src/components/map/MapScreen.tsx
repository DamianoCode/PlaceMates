"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, LayoutGrid, Plus } from "lucide-react";
import { MapViewClient } from "./MapViewClient";
import { PlacePreviewSheet } from "./PlacePreviewSheet";

type Category = { id: string; name: string; icon?: string };

export function MapScreen({
  categories,
  wishlistedIds,
}: {
  categories: Category[];
  wishlistedIds: string[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const wishSet = new Set(wishlistedIds);

  return (
    <div className="relative h-[calc(100dvh-56px-env(safe-area-inset-bottom))] w-full">
      <MapViewClient
        categoryFilter={categoryFilter}
        wishlistOnly={wishlistOnly}
        wishlistedIds={wishSet}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
      />

      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-2">
        <div className="pointer-events-auto mx-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border/50 bg-background/90 p-1 shadow-md backdrop-blur no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]">
          <FilterPill
            active={!categoryFilter && !wishlistOnly}
            onClick={() => {
              setCategoryFilter(null);
              setWishlistOnly(false);
            }}
            icon={<LayoutGrid size={14} />}
          >
            Wszystkie
          </FilterPill>
          <FilterPill
            active={wishlistOnly}
            onClick={() => {
              setCategoryFilter(null);
              setWishlistOnly(!wishlistOnly);
            }}
            icon={<Heart size={14} fill={wishlistOnly ? "currentColor" : "none"} />}
          >
            Wishlist
          </FilterPill>
          <span className="mx-0.5 h-5 w-px flex-shrink-0 bg-border" aria-hidden />
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => {
                setCategoryFilter(categoryFilter === c.id ? null : c.id);
                setWishlistOnly(false);
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
    "inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
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
