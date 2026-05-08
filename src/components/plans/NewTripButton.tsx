"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTripDialog } from "./CreateTripDialog";

type Group = { id: string; name: string };

/** Opens the CreateTripDialog. Standalone so it can be dropped into
 *  any RSC page without lifting state up. */
export function NewTripButton({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={groups.length === 0}>
        <Plus size={16} className="mr-1.5" />
        Nowy plan
      </Button>
      <CreateTripDialog
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
      />
    </>
  );
}
