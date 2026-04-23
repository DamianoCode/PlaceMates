import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { getAuth } from "@/infra/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Proxy already redirects unauthenticated users, but we double-check here
  // so Server Components below can assume a user is present.
  const user = await (await getAuth()).getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(56px+env(safe-area-inset-bottom))]">
      <div className="flex-1">{children}</div>
      <BottomNav />
    </div>
  );
}
