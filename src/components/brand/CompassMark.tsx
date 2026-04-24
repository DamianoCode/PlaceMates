/**
 * The PlaceMates compass glyph — the visual signature. Used inline as
 * a wordmark prefix, as a decorative watermark, and rasterised as the
 * favicon / PWA icon. Sized via a single `size` prop so it can scale
 * from 16px (favicon) up to 512px (splash) without redrawing.
 *
 * The four-point star + offset north indicator reads as "compass" at
 * any size; the muted horizontal axis adds depth without busying up
 * the small sizes.
 */
export function CompassMark({
  size = 22,
  className,
  filled = true,
}: {
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M12 3 L14 12 L12 21 L10 12 Z"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 1.3}
        opacity={filled ? 0.9 : 1}
      />
      <path
        d="M3 12 L12 10 L21 12 L12 14 Z"
        fill="currentColor"
        opacity="0.35"
      />
      <circle cx="12" cy="12" r="1.6" fill="var(--color-background, #fff)" />
    </svg>
  );
}
