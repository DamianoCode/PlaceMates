"use client";

import { useState, type ReactNode } from "react";

/**
 * Profile photo with a graceful fallback. Avatars come from OAuth
 * providers (Google's lh3 host refuses hot-linked requests that carry a
 * referrer, and URLs expire), so a broken-image glyph was a real outcome.
 * `no-referrer` fixes the common case; on any load error we swap to the
 * caller's fallback (initials) instead of showing the browser's glyph.
 */
export function AvatarImage({
  src,
  fallback,
  className,
  loading = "lazy",
}: {
  src: string | null | undefined;
  fallback: ReactNode;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
