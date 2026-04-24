"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  leaveGroupAction,
  type LeaveGroupState,
} from "@/app/(app)/groups/actions";

export function LeaveGroupForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState<LeaveGroupState, FormData>(
    leaveGroupAction,
    null,
  );
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        <LogOut size={14} className="mr-2" />
        {pending ? "Opuszczam…" : "Opuść grupę"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
