"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Confirmation modal. Rendered into a portal so nothing in the page can
 * clip it; backdrop-click and Escape both dismiss. Initial focus goes to
 * the confirm button — except for destructive dialogs, where it lands on
 * Cancel so a stray Enter never deletes anything. Tab cycles inside the
 * panel (a tiny hand-rolled trap: there are only two buttons). The
 * destructive variant tints the confirm button so the consequence is
 * visually obvious and is announced as an alertdialog.
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Escape + focus management. We capture the previously-focused element
  // on open and restore it on close so keyboard users land back where
  // they were.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep focus inside the panel: wrap from last to first and back.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Safe default focus once the dialog has mounted (see header note).
    queueMicrotask(() =>
      (destructive ? cancelRef : confirmRef).current?.focus(),
    );
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // The trigger may be gone (e.g. the deleted row's trash button);
      // only restore focus to something still in the document.
      const prev = previouslyFocused.current;
      if (prev?.isConnected) prev.focus();
    };
  }, [open, onOpenChange, destructive]);

  if (!open || typeof document === "undefined") return null;

  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return createPortal(
    <div
      role={destructive ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={panelRef}
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
            <h2 id={titleId} className="font-display text-xl leading-tight">
              {title}
            </h2>
            {description && (
              <div
                id={descriptionId}
                className="mt-1.5 text-sm italic text-muted-foreground"
              >
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-3">
          <Button
            ref={cancelRef}
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
