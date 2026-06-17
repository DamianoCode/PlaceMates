import { after } from "next/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { NetworkStatusBanner } from "@/components/pwa/NetworkStatusBanner";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { getCurrentUser } from "@/infra/auth";
import { ensureProfileAvatar } from "@/domain/profile/service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Proxy already redirects unauthenticated users, but we double-check here
  // so Server Components below can assume a user is present.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Self-heal a missing profile avatar from the OAuth metadata once, off
  // the render path. Guarded (only writes when the column is NULL), so it's
  // a no-op after the first heal and never blocks the page.
  const avatarUrl = user.avatarUrl;
  if (avatarUrl) after(() => ensureProfileAvatar(user.id, avatarUrl));

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(60px+env(safe-area-inset-bottom))]">
      {/* Route cross-fade is handled natively by the browser's View
       *  Transitions (experimental.viewTransition) — no wrapper needed. */}
      <div className="flex-1">{children}</div>
      <BottomNav />
      <InstallPrompt />
      <NetworkStatusBanner />
      <ServiceWorkerRegistration />
    </div>
  );
}
