import type { LucideIcon } from "lucide-react";

export function StatPill({
  icon: Icon,
  value,
  label,
  index = 0,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  /** 0-based position in the row; used for a tiny staggered mount reveal. */
  index?: number;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border bg-card px-2 py-2 text-center"
      style={{
        animation: `pm-fade-up 400ms ${index * 55}ms ease-out both`,
      }}
    >
      <Icon size={16} className="text-muted-foreground" />
      <span className="text-base font-semibold leading-tight tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
