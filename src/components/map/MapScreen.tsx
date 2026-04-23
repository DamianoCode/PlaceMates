"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MapViewClient } from "./MapViewClient";

type Category = { id: string; name: string };

export function MapScreen({
  categories,
  wishlistedIds,
}: {
  categories: Category[];
  wishlistedIds: string[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const wishSet = new Set(wishlistedIds);

  return (
    <div className="relative h-[calc(100dvh-56px-env(safe-area-inset-bottom))] w-full">
      <MapViewClient
        categoryFilter={categoryFilter}
        wishlistOnly={wishlistOnly}
        wishlistedIds={wishSet}
      />

      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-background/90 p-1 shadow-md backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              setWishlistOnly(false);
            }}
            className={pillClass(!categoryFilter && !wishlistOnly)}
          >
            Wszystkie
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(null);
              setWishlistOnly(true);
            }}
            className={pillClass(wishlistOnly)}
          >
            Wishlist
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === c.id ? null : c.id);
                setWishlistOnly(false);
              }}
              className={pillClass(categoryFilter === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

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

function pillClass(active: boolean) {
  const base =
    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
  return active
    ? `${base} bg-primary text-primary-foreground`
    : `${base} text-muted-foreground hover:bg-muted hover:text-foreground`;
}
