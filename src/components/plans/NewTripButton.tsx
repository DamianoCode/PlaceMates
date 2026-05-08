"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateTripDialog } from "./CreateTripDialog";

type Group = { id: string; name: string };

/**
 * Opens the CreateTripDialog. Two visual variants — text-with-icon
 * pill for primary CTA contexts (empty state hero), and icon-only
 * round button for the PageHeader trailing slot. Same dialog
 * underneath; just a different trigger silhouette.
 */
export function NewTripButton({
  groups,
  variant = "default",
}: {
  groups: Group[];
  /**
   * `default` = "+ Nowy plan" text pill, used as a primary CTA.
   * `icon`    = round Plus button with no label, sized for
   *             PageHeader trailing alongside other icon actions.
   */
  variant?: "default" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const disabled = groups.length === 0;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Nowy plan"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
          )}
        >
          <Plus size={18} />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={disabled}>
          <Plus size={16} className="mr-1.5" />
          Nowy plan
        </Button>
      )}
      <CreateTripDialog
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
      />
    </>
  );
}
