# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA (`public/manifest.webmanifest`: standalone, portrait, `start_url: /map`, `lang: pl`). Mobile web is the primary form factor; there is no native wrapper.

## Users

- **Primary:** members of a small, Polish-speaking group of friends who keep returning to the same cafés, restaurants, viewpoints and trails and want one shared place for their opinions. They use the app on a phone, out in the field: rating a place while sitting in it, adding a pin they just found, checking off trip stops as they go.
- **Secondary:** developers who find the project on GitHub as open-source/portfolio work (AGPL-3.0) and may self-host their own instance. They evaluate it through the README, the code and a running instance, not through in-app marketing.

## Product Purpose

PlaceMates is one shared map per friend group: places, ratings tailored to what is being rated, shared lists and trip plans. It exists because a group's opinions about the places it actually goes otherwise live nowhere you can find later. Success means the group reaches for it in the moment (at the table, on the trail) and can later answer "where should we go?" from its own history rather than from strangers' reviews.

## Positioning

What a neighbouring product (Google Maps lists/reviews, Mapstr) cannot truthfully claim, all four confirmed as core:

1. **Group privacy.** Opinions come only from your own people, not anonymous strangers.
2. **Category-specific rating schemas.** A café is scored on coffee, vibe and price; a viewpoint on the view and the effort to reach it. Individual menu items (dishes, products, services) are rated too.
3. **Planning together.** Ordered shared trip plans with times and check-offs, plus distinct lists for "I want to go" (personal wishlist), "we should go" (group to-visit) and personal favourites.
4. **Rankings across groups.** Search-sourced places share a provider-agnostic canonical identity, so the same real place rated in several groups can share one ranking; hand-dropped pins stay private to their group.

## Operating Context

- Used one-handed on a phone, often outdoors, in variable light and on patchy mobile connections; an offline route (`/offline`) and a service worker exist.
- Map-first: the app opens on `/map` (MapLibre, OpenFreeMap tiles, clustered pins).
- Group lifecycle: invite by expiring link (`/join/[token]`); everyone in the group sees the same pins, ratings and lists.
- Ratings roll up per person into one overall score, and into a group average.
- Opt-in web push notifies the group when someone rates a place you added, adds a new spot, or ticks off a stop.
- Single ratings can be shared publicly via `/share/[slug]` — the one surface seen by people outside a group.
- Retrospective surfaces exist: group feed, insights, and a year review.

## Capabilities and Constraints

- Routes: map, places (list, detail, edit, new, items), plans, wishlist, favorites, discover, ranking (global and per canonical place), groups (overview, feed, insights, year), me; auth (login, register, forgot/reset password); join, share, offline.
- Nearby POI search over the visible map (Geoapify, Overpass fallback) with bulk add and automatic categorisation; geocoding via Photon/Nominatim; routing (drive/cycle/walk) via OpenRouteService, cached per trip.
- Must degrade gracefully without optional API keys (keyless providers take over).
- Stack: Next.js 16 (pinned build with non-standard conventions — see `AGENTS.md`), React 19, Tailwind CSS v4, shadcn/Base UI, vaul drawers, sonner toasts, TanStack Query/Virtual, Supabase (Postgres + PostGIS, auth, storage), Drizzle.
- UI language is Polish only; code and README are English. No i18n layer is planned.
- Undecided: whether the product ever opens to the public beyond friends and self-hosters. There is currently no landing page; `/` redirects to `/map` or `/login`.

## Brand Commitments

- Name: **PlaceMates**. Manifest tagline: "Prywatne oceny miejsc z bliskimi."
- Mark: `CompassMark` (`src/components/brand/CompassMark.tsx`), plus PWA icons in `public/icons/`.
- Voice (from README and UI copy): casual, direct, personal — written for friends, not customers; no corporate language.

## Evidence on Hand

- README (EN + PL) describing features and motivation.
- Real usage data lives only in the production database; nothing in the repo.
- There are no testimonials, user counts, press, benchmarks or case studies. Future work must not invent them.

## Product Principles

1. **Your people, not the crowd.** Every surface privileges the group's own opinions over generic or public data.
2. **Built for the moment in the field.** Fast, one-handed, phone-first actions beat desktop richness; rating or checking off a stop must take seconds.
3. **Rate things on their own terms.** Respect the category schema and per-item depth rather than flattening everything into one star count.
4. **Distinguish "me" from "us".** Personal and shared intent (wishlist vs. group to-visit, own score vs. group average) stay visibly separate.
5. **Degrade, don't break.** Missing keys, flaky networks and offline moments should leave a working app.

## Accessibility & Inclusion

No formal standard has been committed to. Known needs from the operating context: legible outdoors on a phone, comfortable touch targets for one-handed use, and full Polish-language copy.
