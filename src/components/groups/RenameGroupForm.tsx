"use client";

import { useActionState, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  renameGroupAction,
  type RenameGroupState,
} from "@/app/(app)/groups/actions";

export function RenameGroupForm({
  groupId,
  currentName,
  canEdit,
}: {
  groupId: string;
  currentName: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<RenameGroupState, FormData>(
    renameGroupAction,
    null,
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const error = state && "error" in state ? state.error : null;

  if (!canEdit) {
    return <h1 className="font-display text-3xl leading-tight">{currentName}</h1>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(currentName);
          setEditing(true);
        }}
        className="group inline-flex items-baseline gap-2 text-left"
      >
        <h1 className="font-display text-3xl leading-tight">{currentName}</h1>
        <PencilLine
          size={16}
          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex items-center gap-2">
        <Input
          name="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          maxLength={80}
          required
          className="font-display text-2xl"
        />
        <Button type="submit" size="icon" disabled={pending} aria-label="Zapisz">
          <Check size={18} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setEditing(false)}
          aria-label="Anuluj"
        >
          <X size={18} />
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
