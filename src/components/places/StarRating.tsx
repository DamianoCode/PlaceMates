import { Star, StarHalf } from "lucide-react";

/**
 * Read-only star rating with half-step rendering.
 * value: 0..max, rounded to the nearest 0.5.
 * Uses full-star, half-star, and empty-star glyphs so 4.5 renders cleanly.
 */
export function StarRating({
  value,
  max = 5,
  size = 14,
  className = "",
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full === 0.5;
  const empty = Math.max(0, max - full - (hasHalf ? 1 : 0));

  return (
    <span
      className={"inline-flex items-center gap-0.5 " + className}
      aria-label={`${rounded.toFixed(1)} z ${max}`}
    >
      {Array.from({ length: full }).map((_, i) => (
        <Star
          key={`f${i}`}
          size={size}
          className="fill-amber-400 stroke-amber-500"
        />
      ))}
      {hasHalf && (
        <StarHalf
          size={size}
          className="fill-amber-400 stroke-amber-500"
        />
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star
          key={`e${i}`}
          size={size}
          className="fill-transparent stroke-muted-foreground/40"
        />
      ))}
    </span>
  );
}
