"use client";

import { useActionState, useState } from "react";
import { Copy, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createShareAction,
  revokeShareAction,
  type ShareState,
} from "@/app/(app)/places/[id]/share-actions";

export function ShareRating({
  placeId,
  initialSlug,
  baseUrl,
  hasRating,
}: {
  placeId: string;
  initialSlug: string | null;
  baseUrl: string;
  hasRating: boolean;
}) {
  const [createState, createAction, creating] = useActionState<ShareState, FormData>(
    createShareAction,
    null,
  );
  const [revokeState, revokeAction, revoking] = useActionState<ShareState, FormData>(
    revokeShareAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  const currentSlug =
    revokeState && "slug" in revokeState
      ? revokeState.slug
      : createState && "slug" in createState
        ? createState.slug
        : initialSlug;
  const error =
    (createState && "error" in createState && createState.error) ||
    (revokeState && "error" in revokeState && revokeState.error) ||
    null;
  const url = currentSlug ? `${baseUrl}/share/${currentSlug}` : null;

  if (!hasRating) {
    return (
      <p className="text-sm text-muted-foreground">
        Wystaw ocenę, żeby móc ją udostępnić.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!currentSlug && (
        <form action={createAction}>
          <input type="hidden" name="placeId" value={placeId} />
          <Button type="submit" variant="outline" disabled={creating}>
            <Share2 size={16} className="mr-2" />
            {creating ? "Generuję…" : "Udostępnij opinię linkiem"}
          </Button>
        </form>
      )}

      {url && (
        <>
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
          <form action={revokeAction}>
            <input type="hidden" name="slug" value={currentSlug ?? ""} />
            <input type="hidden" name="placeId" value={placeId} />
            <Button type="submit" variant="ghost" disabled={revoking}>
              <X size={14} className="mr-1" />
              {revoking ? "Wyłączam…" : "Wyłącz udostępnienie"}
            </Button>
          </form>
        </>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
