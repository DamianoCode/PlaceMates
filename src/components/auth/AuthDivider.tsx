/** Thin decorative divider with an inline label. Used between OAuth
 * and password auth forms to signal "alternative way to sign in". */
export function AuthDivider({ label = "albo" }: { label?: string }) {
  return (
    <div className="relative flex items-center py-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="px-3 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
