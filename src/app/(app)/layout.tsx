import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteTransition } from "@/components/layout/RouteTransition";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { NetworkStatusBanner } from "@/components/pwa/NetworkStatusBanner";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { getCurrentUser } from "@/infra/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Proxy already redirects unauthenticated users, but we double-check here
  // so Server Components below can assume a user is present.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(60px+env(safe-area-inset-bottom))]">
      <div className="flex-1">
        <RouteTransition>{children}</RouteTransition>
      </div>
      <BottomNav />
      <InstallPrompt />
      <NetworkStatusBanner />
      <ServiceWorkerRegistration />
    </div>
  );
}
