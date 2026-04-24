import type { ReactNode } from "react";

// Auth pages own their own full-bleed layout (see AuthShell) so this
// layout is intentionally a passthrough. Keeping the file around lets
// us drop shared providers / metadata here later without touching
// login and register individually.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
