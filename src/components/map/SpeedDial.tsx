"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpeedDialAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

/**
 * Material-style speed dial: a primary FAB that expands into labelled
 * sub-FABs stacked above it. Clicking the FAB again, choosing an action,
 * pressing Escape, or tapping outside all close the dial.
 */
export function SpeedDial({
  actions,
  ariaLabel = "Szybkie akcje",
}: {
  actions: SpeedDialAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="absolute right-4 bottom-4 z-20 flex flex-col items-end"
    >
      {/* Staggered sub-FABs. Rendered only when open; each gets a
       *  transform-origin near the main FAB so they spring outward. */}
      {open && (
        <ul className="mb-3 flex flex-col items-end gap-2.5">
          {actions.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-2.5"
              style={{ animation: `speed-dial-in 160ms ${i * 30}ms both ease-out` }}
            >
              <span className="rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur">
                {a.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={a.label}
              >
                {a.icon}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all",
          "hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "rotate-45",
        )}
      >
        <Plus size={26} strokeWidth={2.25} />
      </button>

      <style jsx>{`
        @keyframes speed-dial-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.85);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
