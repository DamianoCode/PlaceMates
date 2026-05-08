"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Map, Route, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Wishlist + Favorites collapsed into the /places list as filter
// pills — they were the same view with an extra `where` clause and
// the user can now combine them with category filters (e.g. ulubione
// restauracje). Frees a tab slot for Ranking, which previously sat
// buried inside /me.
//
// Plany sits between Miejsca and Ranking — natural flow from
// see (Mapa) → list (Miejsca) → organize (Plany) → discover
// (Ranking) → me (Ja). Five tabs is the BottomNav ceiling but
// readable on phones ≥360 px wide.
const ITEMS = [
  { href: "/map", label: "Mapa", icon: Map },
  { href: "/places", label: "Miejsca", icon: List },
  { href: "/plans", label: "Plany", icon: Route },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/me", label: "Ja", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Nawigacja główna"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={22} aria-hidden className={active ? "stroke-[2.25]" : undefined} />
                <span className={active ? "font-medium" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
