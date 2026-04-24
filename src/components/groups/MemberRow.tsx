"use client";

import { useActionState } from "react";
import { Crown, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  removeMemberAction,
  type RemoveMemberState,
} from "@/app/(app)/groups/actions";

export function MemberRow({
  groupId,
  member,
  canManage,
  isSelf,
}: {
  groupId: string;
  member: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    role: "owner" | "member";
    joinedAt: Date;
  };
  canManage: boolean;
  isSelf: boolean;
}) {
  const initials = (member.displayName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-medium text-primary">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium">
            {member.displayName}
            {isSelf && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (ty)
              </span>
            )}
          </p>
          {member.role === "owner" && (
            <Crown size={14} className="flex-shrink-0 text-primary" aria-label="Właściciel" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {member.role === "owner" ? "Właściciel" : "Członek"} · dołączył{" "}
          {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
            member.joinedAt,
          )}
        </p>
      </div>

      {canManage && !isSelf && member.role !== "owner" && (
        <RemoveButton groupId={groupId} userId={member.userId} />
      )}
    </li>
  );
}

function RemoveButton({ groupId, userId }: { groupId: string; userId: string }) {
  const [state, action, pending] = useActionState<RemoveMemberState, FormData>(
    removeMemberAction,
    null,
  );
  const error = state && "error" in state ? state.error : null;
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="targetUserId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Usuń z grupy"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors",
          "hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <UserMinus size={16} />
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
