"use client";

import { useActionState, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  leaveGroupAction,
  type LeaveGroupState,
} from "@/app/(app)/groups/actions";

export function LeaveGroupForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState<LeaveGroupState, FormData>(
    leaveGroupAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state && "error" in state ? state.error : null;

  return (
    <>
      <form ref={formRef} action={action} className="space-y-2">
        <input type="hidden" name="groupId" value={groupId} />
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant="destructive"
          disabled={pending}
        >
          <LogOut size={14} className="mr-2" />
          {pending ? "Opuszczam…" : "Opuść grupę"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Opuścić grupę?"
        description="Stracisz dostęp do miejsc i ocen tej grupy. Możesz wrócić, jeśli ktoś wyśle ci nowe zaproszenie."
        confirmLabel="Opuść grupę"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}
