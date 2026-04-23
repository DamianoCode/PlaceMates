"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInviteAction, type InviteState } from "@/app/(app)/me/actions";

export function InviteForm({
  groupId,
  groupName,
  baseUrl,
}: {
  groupId: string;
  groupName: string;
  baseUrl: string;
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  const error = state && "error" in state ? state.error : null;
  const token = state && "token" in state ? state.token : null;
  const url = token ? `${baseUrl}/join/${token}` : null;

  return (
    <div className="space-y-3">
      <form action={action}>
        <input type="hidden" name="groupId" value={groupId} />
        <Button type="submit" disabled={pending} variant="outline">
          {pending ? "Generuję..." : `Wygeneruj link do ${groupName}`}
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {url && (
        <div className="flex items-center gap-2 rounded-md border p-2">
          <code className="flex-1 truncate text-xs">{url}</code>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Skopiuj link"
          >
            <Copy size={16} className="mr-1" />
            {copied ? "Skopiowano" : "Kopiuj"}
          </Button>
        </div>
      )}
    </div>
  );
}
