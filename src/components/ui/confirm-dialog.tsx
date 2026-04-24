"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Confirmation modal. Rendered into a portal so nothing in the page can
 * clip it; backdrop-click and Escape both dismiss. The confirm button
 * autofocuses so pressing Enter immediately confirms and keyboard
 * navigation is predictable. Destructive variant tints the confirm
 * button so the consequence is visually obvious.
 *
 * Design note: no focus-trap library — we only have two buttons, so
 * tab-cycling works fine. If we ever add forms inside the dialog we
 * should revisit.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Escape + focus management. We capture the previously-focused element
  // on open and restore it on close so keyboard users land back where
  // they were.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Autofocus the confirm button once the dialog has mounted.
    queueMicrotask(() => confirmRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-2xl border bg-background shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150",
        )}
      >
        <div className="flex items-start gap-3 p-5">
          {destructive && (
            <div
              aria-hidden
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
            >
              <AlertTriangle size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight">{title}</h2>
            {description && (
              <div className="mt-1.5 text-sm italic text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
