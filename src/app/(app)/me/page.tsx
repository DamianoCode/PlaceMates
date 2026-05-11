import Link from "next/link";
import {
  ChevronRight,
  Globe,
  KeyRound,
  Palette,
  Users as UsersIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuth } from "@/infra/auth";
import { listUserGroups } from "@/domain/groups/service";
import { getProfile } from "@/domain/profile/service";
import { getNotificationPrefs } from "@/domain/push/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountHeader } from "@/components/layout/AccountHeader";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CreateGroupForm } from "@/components/groups/CreateGroupForm";
import { GroupListItem } from "@/components/groups/GroupListItem";
import { PushNotificationsCard } from "@/components/push/PushNotificationsCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default async function MePage() {
  const user = await (await getAuth()).getUser();
  const [groups, profile, notificationPrefs] = user
    ? await Promise.all([
        listUserGroups(user.id),
        getProfile(user.id),
        getNotificationPrefs(user.id),
      ])
    : [[], null, { rating: true, stopCompleted: true, newPlace: true }];

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <>
      <PageHeader title="Twoje konto" fallbackHref="/map" />
      <section className="mx-auto max-w-2xl space-y-5 p-4">
        {user && (
          <AccountHeader
            displayName={profile?.displayName ?? user.displayName}
            email={user.email}
            avatarUrl={profile?.avatarUrl ?? user.avatarUrl}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <UsersIcon size={18} /> Twoje grupy
            </CardTitle>
            <CardDescription>
              Każda grupa to osobny świat miejsc i opinii. Zaproś bliskich lub
              trzymaj wszystko dla siebie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((g) => (
              <GroupListItem key={g.id} group={g} />
            ))}
            <CreateGroupForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Odkrywaj</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {/* Ranking + Plany trafiły do BottomNav jako własne
             *  zakładki, Ulubione + Do odwiedzenia są filter pillsami
             *  na /places. "Publiczne opinie" zostaje tutaj jako
             *  rzadziej-odwiedzana destynacja która nie zarabia
             *  na slot w BottomNav. */}
            <NavRow
              href="/discover"
              icon={<Globe size={18} className="text-primary" />}
              title="Publiczne opinie"
              subtitle="Oceny udostępnione przez innych"
            />
          </CardContent>
        </Card>

        {user && (
          <PushNotificationsCard
            initialPrefs={notificationPrefs}
            vapidPublicKey={vapidPublicKey}
          />
        )}

        {user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <KeyRound size={18} /> Bezpieczeństwo
              </CardTitle>
              <CardDescription>
                Zmień hasło logowania. Sesje na innych urządzeniach
                pozostają aktywne — wyloguj się tam ręcznie, jeśli to
                istotne.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Palette size={18} /> Wygląd
            </CardTitle>
            <CardDescription>
              Jasny, ciemny, albo zgodnie z systemem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function NavRow({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:text-foreground"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
