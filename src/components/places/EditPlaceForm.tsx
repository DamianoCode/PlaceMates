"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapViewClient } from "@/components/map/MapViewClient";
import {
  updatePlaceAction,
  type UpdatePlaceState,
} from "@/app/(app)/places/actions";

type Category = { id: string; name: string };

export function EditPlaceForm({
  placeId,
  initialName,
  initialCategoryId,
  initialLat,
  initialLng,
  initialAddress,
  categories,
}: {
  placeId: string;
  initialName: string;
  initialCategoryId: string;
  initialLat: number;
  initialLng: number;
  initialAddress: string | null;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState<UpdatePlaceState, FormData>(
    updatePlaceAction,
    null,
  );

  // Track the current pin location; defaults to the stored one, updates
  // on every map tap so users can drag the place to a new spot.
  const [picked, setPicked] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  const error = state && "error" in state ? state.error : null;
  const moved =
    picked.lat.toFixed(6) !== initialLat.toFixed(6) ||
    picked.lng.toFixed(6) !== initialLng.toFixed(6);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="lat" value={picked.lat} />
      <input type="hidden" name="lng" value={picked.lng} />
      <input
        type="hidden"
        name="address"
        value={moved ? "" : (initialAddress ?? "")}
      />

      <div className="space-y-2">
        <Label>Przesuń pin na mapie, żeby zmienić lokalizację</Label>
        <div className="h-72 overflow-hidden rounded-xl border">
          <MapViewClient
            initial={{ longitude: initialLng, latitude: initialLat, zoom: 15 }}
            initialPick={{ lat: initialLat, lng: initialLng }}
            onPick={(lnglat) => setPicked(lnglat)}
          />
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          {moved && " · (przesunięto)"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nazwa</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={initialName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Kategoria</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={initialCategoryId}
          className="field-base h-11"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </Button>
      </div>
    </form>
  );
}
