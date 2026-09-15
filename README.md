# PlaceMates

A shared map for friend groups who want to remember — and rank — the places they actually go.

**English** · [Polski](#polski)

---

PlaceMates started as a simple itch: a group of people keeps ending up at the same handful of cafés, viewpoints and dinner spots, everyone has an opinion, and none of it lives anywhere you can find later. So this is one shared map per group, with ratings that fit what you're actually rating, and a trip planner for when you want to string a few stops together.

The UI is in Polish (that's who it was built for), but the code and this README are not, so it should be easy enough to follow.

## What you can do

- **Keep places in groups.** A group is a small shared workspace — invite people with an expiring link, and everyone sees the same pins, ratings and lists.
- **Rate things on their own terms.** Each category carries its own rating schema, so a café is scored on coffee, vibe and price while a viewpoint is scored on the view and how much of a hike it was. Per-person scores roll up into one overall number, and into a group average.
- **Go deeper than the place.** Add menu-style items to a place — individual dishes, products, services — and rate those too, with notes and photos.
- **Find places nearby.** Search the visible map for POIs (Geoapify Places, with OpenStreetMap's Overpass as a keyless fallback), and bulk-add the ones you want — each is auto-sorted into the right category.
- **Plan trips together.** A plan is an ordered, shared itinerary: drag stops into order, give them a time, and check them off as you go. Driving / cycling / walking routes come from OpenRouteService and are cached per trip.
- **See cross-group rankings.** Places from search are tied to a provider-agnostic *canonical* identity, so the same real café rated in three different groups can share one ranking — while a pin you dropped by hand stays yours alone.
- **Lists that answer different questions.** A personal wishlist, a shared group "to-visit" list, and personal favourites all coexist, because "I want to go here" and "we should go here" aren't the same thing.
- **Get nudged, if you want.** Opt-in web push (it installs as a PWA) lets the group know when someone rates a place you added, drops a new spot, or ticks off a stop.

## Built with

- **[Next.js](https://nextjs.org) 16** (App Router, Server Actions) and **React 19**, in TypeScript
- **[Supabase](https://supabase.com)** for Postgres, auth (email + optional Google) and file storage
- **[Drizzle ORM](https://orm.drizzle.team)** over `postgres.js`, with **PostGIS** for geography
- **[MapLibre GL](https://maplibre.org)** via `react-map-gl`, tiles from OpenFreeMap, clustering with `supercluster`
- **[TanStack Query](https://tanstack.com/query)** + **Virtual**, **Tailwind CSS v4**, **shadcn**/Base UI, **vaul**, **sonner**
- **[Zod](https://zod.dev)** for validation everywhere user input crosses a boundary
- **Web Push** (VAPID) for notifications, **Sentry** for error tracking
- POIs and geocoding from **Geoapify**, **Overpass**, **Photon** and **Nominatim**; routing from **OpenRouteService**

## Running it locally

You'll need **Node 20+**, a **Supabase** project, and — optionally — keys for Geoapify and OpenRouteService. The app degrades gracefully without the optional ones (search falls back to keyless providers); map tiles come from OpenFreeMap and need no key.

```bash
git clone https://github.com/DamianoCode/PlaceMates.git
cd PlaceMates
npm install
cp .env.example .env      # then fill it in — it's heavily commented
```

The bare minimum to boot is your Supabase URL, its publishable key, and a `DATABASE_URL`. Everything else is optional and explained inline in [`.env.example`](.env.example), including a production-hardening checklist for the Supabase dashboard.

A couple of one-off setup steps on the Supabase side:

1. Enable the **PostGIS** extension (Database → Extensions).
2. Run [`scripts/setup-storage.sql`](scripts/setup-storage.sql) once in the SQL editor to create the photo/avatar buckets and their policies.

Then prepare the database and start the dev server:

```bash
npm run db:migrate       # apply schema migrations
npm run db:seed          # seed the built-in categories
npm run dev              # http://localhost:3000
```

If you want push notifications in dev, generate a VAPID key pair (`npx web-push generate-vapid-keys`) and drop it into `.env` — otherwise the feature simply stays off.

### Handy scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | the usual Next.js trio |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle Kit schema workflow |
| `npm run db:studio` | open Drizzle Studio |
| `npm run db:seed` | seed built-in categories |
| `npm run check:geoapify` | sanity-check the Geoapify category map against their taxonomy |

## How the code is laid out

```
src/
  app/         Next.js routes, Server Actions and API handlers
  domain/      business logic — one folder per aggregate (places, ratings,
               trips, groups, photos, push, …), each returning a Result type
  infra/       database (Drizzle schema + PostGIS), Supabase auth,
               and the geocoding / POI providers
  lib/         Zod schemas and shared utilities
  components/  React components, grouped by feature (map, places, plans, …)
drizzle/       SQL migrations
scripts/       seeding, icon generation, env checks
```

The rough rule: routes and Server Actions in `app/` stay thin and call into `domain/`, which owns the real logic and talks to `infra/`. User input is validated with Zod (`lib/validation`) before it ever reaches a service.

> **Heads-up for contributors:** this repo pins a specific Next.js build whose APIs and conventions can differ from what you might expect. `AGENTS.md` has the details — when in doubt, check the version's own docs under `node_modules/next/dist/docs/`.

## Status & license

This is a personal project, still moving, built primarily for a Polish-speaking group of friends.

Licensed under the **GNU Affero General Public License v3.0 or later** — see [`LICENSE`](LICENSE). In short: you're free to use, study, modify and share it, but if you run a modified version as a network service, you have to make your source available too. Questions or ideas? Open an issue.

© 2026 DamianoCode

---

## Polski

**PlaceMates** to wspólna mapa dla paczki znajomych, którzy chcą zapamiętać — i porównać — miejsca, do których naprawdę chodzą.

[English](#placemates) · **Polski**

Pomysł wziął się z prostej bolączki: grupa ludzi raz po raz ląduje w tych samych kilku kawiarniach, punktach widokowych i knajpach, każdy ma swoje zdanie, a nigdzie tego nie da się później odszukać. Więc to jedna wspólna mapa na grupę, z ocenami dopasowanymi do tego, co faktycznie oceniasz, plus planer wycieczek, gdy chcesz połączyć kilka przystanków w jedną trasę.

Interfejs jest po polsku — bo dla takich osób powstał.

### Co potrafi

- **Miejsca w grupach.** Grupa to mała wspólna przestrzeń — zapraszasz ludzi linkiem z terminem ważności, a wszyscy widzą te same piny, oceny i listy.
- **Oceny na własnych zasadach.** Każda kategoria ma własny schemat oceniania: kawiarnię oceniasz za kawę, klimat i cenę, a punkt widokowy za widok i to, jak bardzo trzeba się było wspiąć. Oceny każdej osoby składają się w jedną notę ogólną i w średnią grupy.
- **Głębiej niż samo miejsce.** Do miejsca dodajesz pozycje w stylu menu — konkretne dania, produkty, usługi — i też je oceniasz, z notatkami i zdjęciami.
- **Znajdź w okolicy.** Przeszukujesz widoczny fragment mapy pod kątem POI (Geoapify Places, z Overpass z OpenStreetMap jako bezkluczową rezerwą) i hurtowo dodajesz wybrane — każde trafia automatycznie do właściwej kategorii.
- **Wspólne planowanie wycieczek.** Plan to uporządkowana, wspólna trasa: przeciągasz przystanki w kolejności, nadajesz im godzinę i odhaczasz po drodze. Trasy (auto / rower / pieszo) liczy OpenRouteService i są cache'owane per plan.
- **Rankingi ponad grupami.** Miejsca z wyszukiwarki dostają wspólną, niezależną od dostawcy tożsamość *kanoniczną*, więc ta sama kawiarnia oceniona w trzech różnych grupach dzieli jeden ranking — a pin postawiony ręcznie pozostaje tylko twój.
- **Listy do różnych pytań.** Osobista lista życzeń, wspólna grupowa lista „do odwiedzenia" i prywatne ulubione działają obok siebie, bo „chcę tu pójść" i „powinniśmy tu pójść" to nie to samo.
- **Powiadomienia, jeśli chcesz.** Opcjonalne web push (instaluje się jako PWA) daje znać grupie, gdy ktoś oceni dodane przez ciebie miejsce, doda nowe albo odhaczy przystanek.

### Na czym stoi

- **[Next.js](https://nextjs.org) 16** (App Router, Server Actions) i **React 19**, w TypeScripcie
- **[Supabase](https://supabase.com)** — Postgres, logowanie (e-mail + opcjonalnie Google) i przechowywanie plików
- **[Drizzle ORM](https://orm.drizzle.team)** na `postgres.js`, z **PostGIS** do geografii
- **[MapLibre GL](https://maplibre.org)** przez `react-map-gl`, kafelki OpenFreeMap, klastrowanie przez `supercluster`
- **[TanStack Query](https://tanstack.com/query)** + **Virtual**, **Tailwind CSS v4**, **shadcn**/Base UI, **vaul**, **sonner**
- **[Zod](https://zod.dev)** do walidacji wszędzie tam, gdzie dane użytkownika przekraczają granicę
- **Web Push** (VAPID) do powiadomień, **Sentry** do błędów
- POI i geokodowanie z **Geoapify**, **Overpass**, **Photon** i **Nominatim**; trasy z **OpenRouteService**

### Uruchomienie lokalnie

Potrzebujesz **Node 20+**, projektu **Supabase** i — opcjonalnie — kluczy do Geoapify i OpenRouteService. Bez tych opcjonalnych aplikacja działa dalej (wyszukiwarka schodzi na bezkluczowych dostawców); kafelki mapy pochodzą z OpenFreeMap i nie wymagają klucza.

```bash
git clone https://github.com/DamianoCode/PlaceMates.git
cd PlaceMates
npm install
cp .env.example .env      # i uzupełnij — plik jest gęsto skomentowany
```

Do startu wystarczy URL Supabase, jego klucz publishable i `DATABASE_URL`. Reszta jest opcjonalna i opisana w [`.env.example`](.env.example) — łącznie z checklistą produkcyjnego utwardzenia po stronie panelu Supabase.

Dwie jednorazowe rzeczy po stronie Supabase:

1. Włącz rozszerzenie **PostGIS** (Database → Extensions).
2. Odpal raz [`scripts/setup-storage.sql`](scripts/setup-storage.sql) w edytorze SQL — utworzy buckety na zdjęcia/awatary i ich polityki.

Potem przygotuj bazę i odpal dev:

```bash
npm run db:migrate       # migracje schematu
npm run db:seed          # wbudowane kategorie
npm run dev              # http://localhost:3000
```

Jeśli chcesz powiadomień push w dev, wygeneruj parę kluczy VAPID (`npx web-push generate-vapid-keys`) i wstaw do `.env` — bez tego funkcja po prostu zostaje wyłączona. Pełna lista komend jest w tabeli w wersji angielskiej powyżej.

### Układ kodu

```
src/
  app/         trasy Next.js, Server Actions i handlery API
  domain/      logika biznesowa — folder na agregat (places, ratings,
               trips, groups, photos, push, …), każdy zwraca typ Result
  infra/       baza (schemat Drizzle + PostGIS), auth Supabase
               oraz dostawcy geokodowania / POI
  lib/         schematy Zod i wspólne narzędzia
  components/  komponenty React, pogrupowane po funkcji (map, places, plans, …)
drizzle/       migracje SQL
scripts/       seedowanie, generowanie ikon, kontrole env
```

Zasada z grubsza taka: trasy i Server Actions w `app/` są cienkie i wołają do `domain/`, gdzie żyje właściwa logika i która rozmawia z `infra/`. Dane użytkownika waliduje Zod (`lib/validation`), zanim dotrą do serwisu.

> **Dla kontrybutorów:** repo trzyma się konkretnego builda Next.js, którego API i konwencje potrafią odbiegać od tego, czego się spodziewasz. Szczegóły w `AGENTS.md` — w razie wątpliwości zaglądaj do dokumentacji danej wersji w `node_modules/next/dist/docs/`.

### Status i licencja

To projekt osobisty, wciąż w ruchu, zbudowany głównie dla polskojęzycznej paczki znajomych.

Na licencji **GNU Affero General Public License v3.0 lub nowszej** — patrz [`LICENSE`](LICENSE). W skrócie: możesz go używać, badać, modyfikować i udostępniać, ale jeśli uruchomisz zmodyfikowaną wersję jako serwis sieciowy, musisz udostępnić też swoje źródła. Pytania albo pomysły? Załóż issue.

© 2026 DamianoCode
