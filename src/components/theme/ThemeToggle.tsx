"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/** Returns true once rendered on the client — avoids set-state-in-effect. */
function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const OPTIONS = [
  { value: "light", label: "Jasny", icon: Sun },
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const current = mounted ? theme ?? "system" : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Motyw"
      className="inline-flex items-center rounded-full border border-border p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
            title={label}
          >
            <Icon size={14} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
