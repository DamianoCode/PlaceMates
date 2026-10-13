"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

/** Paper / night-paper from globals.css — the sticky chrome colour. */
const THEME_COLOR = { light: "#fdf8f0", dark: "#16100c" } as const;

/**
 * The viewport `themeColor` metas only follow `prefers-color-scheme`,
 * so an explicit in-app choice (dark app on a light phone) left the
 * status bar / PWA chrome in the wrong colour. Once the theme resolves,
 * point every theme-color meta at the active theme.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = THEME_COLOR[resolvedTheme];
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color));
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
