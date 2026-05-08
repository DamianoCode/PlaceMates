import Link from "next/link";
import {
  CalendarRange,
  ChevronRight,
  Globe,
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
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountHeader } from "@/components/layout/AccountHeader";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CreateGroupForm } from "@/components/groups/CreateGroupForm";
import { GroupListItem } from "@/components/groups/GroupListItem";

export default async function MePage() {
  const user = await (await getAuth()).getUser();
  const [groups, profile] = user
    ? await Promise.all([listUserGroups(user.id), getProfile(user.id)])
    : [[], null];

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
            {/* Ranking jumped to BottomNav as its own tab, and
             *  Ulubione + Do odwiedzenia are now filter pills on
             *  /places — both navigation duplicates removed.
             *  "Publiczne opinie" stays here as a less-frequent
             *  destination that doesn't earn a tab. Plany ląduje
             *  tutaj zamiast w BottomNav póki feature dojrzewa. */}
            <NavRow
              href="/plans"
              icon={<CalendarRange size={18} className="text-primary" />}
              title="Plany"
              subtitle="Wycieczki i wypady z odhaczaniem stopów"
            />
            <NavRow
              href="/discover"
              icon={<Globe size={18} className="text-primary" />}
              title="Publiczne opinie"
              subtitle="Oceny udostępnione przez innych"
            />
          </CardContent>
        </Card>

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
