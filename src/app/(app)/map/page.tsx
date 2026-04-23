import Link from "next/link";
import { Plus } from "lucide-react";
import { MapViewClient } from "@/components/map/MapViewClient";

export default function MapPage() {
  return (
    <div className="relative h-[calc(100dvh-56px-env(safe-area-inset-bottom))] w-full">
      <MapViewClient />
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
