import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared empty-state panel: a soft dashed frame with an optional icon
 * medallion above the message. Matches the editorial weight of the major
 * panels (rounded-3xl) so "nothing here yet" reads as intentional rather
 * than forgotten. Used across ranking / insights / feed.
 */
export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed p-10 text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary/70">
          <Icon size={24} strokeWidth={1.75} />
        </span>
      )}
      <p className="max-w-sm text-sm italic text-muted-foreground">{children}</p>
    </div>
  );
}
