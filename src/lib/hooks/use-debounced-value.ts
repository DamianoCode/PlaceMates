"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs` after the latest update. Useful
 * for feeding a TanStack Query key from a fast-changing input — every
 * keystroke would otherwise spawn a new query.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
