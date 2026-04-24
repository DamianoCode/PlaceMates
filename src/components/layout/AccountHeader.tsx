import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(auth)/actions";

export function AccountHeader({
  displayName,
  email,
  avatarUrl,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
}) {
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center gap-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 font-display text-2xl font-semibold text-primary">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl leading-tight">{displayName}</h2>
        <p className="truncate text-sm italic text-muted-foreground">{email}</p>
      </div>
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Wyloguj"
          title="Wyloguj"
        >
          <LogOut size={18} />
        </Button>
      </form>
    </header>
  );
}
