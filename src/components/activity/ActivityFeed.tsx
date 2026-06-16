"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ActivityCursor, ActivityView } from "@/domain/activity/service";
import { loadMoreActivityAction } from "@/app/(app)/groups/[id]/feed/actions";
import { ActivityItem } from "./ActivityItem";

/**
 * Infinite-scroll activity feed. The server renders the first page; this
 * client component appends further pages as a bottom sentinel nears the
 * viewport. An IntersectionObserver (not a scroll listener) drives the
 * load — zero work between fetches — and rows use content-visibility so a
 * long feed stays cheap without a full virtualizer.
 */
export function ActivityFeed({
  groupId,
  initialItems,
  initialCursor,
}: {
  groupId: string;
  initialItems: ActivityView[];
  initialCursor: ActivityCursor | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Overlap guard, only written inside the async callback (never in render).
  const loadingRef = useRef(false);

  // Depends on `cursor`: each loaded page produces a fresh callback, which
  // re-arms the observer effect below for the next page (cursor null →
  // sentinel unmounts → loading stops).
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await loadMoreActivityAction(groupId, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [groupId, cursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // Start fetching before the sentinel is actually visible so the next
      // page is usually ready by the time the user reaches it.
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}
      </ul>

      {cursor && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-6 text-muted-foreground"
          aria-hidden={!loading}
        >
          {loading && (
            <span className="flex items-center gap-2 text-xs">
              <Loader2 size={14} className="animate-spin" />
              Wczytywanie…
            </span>
          )}
        </div>
      )}
    </>
  );
}
