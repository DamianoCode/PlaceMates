import type { ViewState } from "react-map-gl/maplibre";

const KEY = "placemates:map:camera";

export type StoredCamera = Pick<ViewState, "longitude" | "latitude" | "zoom">;

/** Lazy-safe read: returns null on the server and on parse errors. */
export function loadCamera(): StoredCamera | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCamera>;
    if (
      typeof parsed.longitude !== "number" ||
      typeof parsed.latitude !== "number" ||
      typeof parsed.zoom !== "number"
    ) {
      return null;
    }
    return {
      longitude: parsed.longitude,
      latitude: parsed.latitude,
      zoom: parsed.zoom,
    };
  } catch {
    return null;
  }
}

export function saveCamera(cam: StoredCamera): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cam));
  } catch {
    // QuotaExceeded etc — not worth alerting the user for a map position.
  }
}
