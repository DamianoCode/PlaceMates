"use client";

import { useState } from "react";
import { List, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { TripStopList } from "./TripStopList";
import { TripMapViewClient } from "./TripMapViewClient";
import type { TripStopView } from "@/domain/trips/service";

/**
 * Body of the trip detail page — Lista / Mapa toggle plus the
 * matching view. Local state, not URL-driven; the toggle is a
 * personal preference that doesn't deserve a query param polluting
 * everyone's shared bookmarks.
 */
export function TripDetailView({
  stops,
  tripId,
}: {
  stops: TripStopView[];
  tripId: string;
}) {
  const [mode, setMode] = useState<"list" | "map">("list");

  return (
    <div className="space-y-3">
      {/* Segmented control — both halves equal width, single border
       *  frame around the pair so it reads as one cohesive component
       *  rather than two loose buttons. */}
      <div
        role="tablist"
        aria-label="Widok planu"
        className="grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-muted/40 p-1"
      >
        <ToggleButton
          active={mode === "list"}
          onClick={() => setMode("list")}
          icon={<List size={14} />}
          label="Lista"
        />
        <ToggleButton
          active={mode === "map"}
          onClick={() => setMode("map")}
          icon={<Map size={14} />}
          label="Mapa"
        />
      </div>

      {mode === "list" ? (
        <TripStopList stops={stops} tripId={tripId} />
      ) : (
        <TripMapViewClient stops={stops} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
