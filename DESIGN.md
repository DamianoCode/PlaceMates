---
name: PlaceMates
description: A private atlas for a group of friends — warm paper, terracotta ink, contour lines and a compass.
colors:
  paper: "oklch(0.98 0.012 80)"
  espresso-ink: "oklch(0.22 0.02 50)"
  card-white: "oklch(1 0 0)"
  terracotta: "oklch(0.58 0.14 42)"
  terracotta-ink-on: "oklch(0.98 0.012 80)"
  sand-wash: "oklch(0.94 0.02 75)"
  linen-muted: "oklch(0.95 0.015 75)"
  dust-text: "oklch(0.5 0.02 50)"
  apricot-highlight: "oklch(0.92 0.04 70)"
  map-edge: "oklch(0.88 0.02 70)"
  field-edge: "oklch(0.9 0.02 70)"
  brick-alert: "oklch(0.58 0.21 25)"
  night-paper: "oklch(0.18 0.012 60)"
  night-card: "oklch(0.22 0.013 55)"
  night-terracotta: "oklch(0.72 0.14 50)"
  night-ink: "oklch(0.94 0.012 80)"
  pin-favorite-rose: "oklch(0.645 0.246 16.439)"
  pin-wishlist-emerald: "oklch(0.696 0.17 162.48)"
  pin-group-sky: "oklch(0.685 0.169 237.323)"
  star-amber: "oklch(0.828 0.189 84.429)"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontFeature: "\"ss01\", \"ss02\""
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.015em"
    fontFeature: "\"ss01\", \"ss02\""
  title:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: "-0.005em"
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "-0.005em"
  eyebrow:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.32em"
rounded:
  sm: "0.45rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
  3xl: "1.65rem"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.terracotta-ink-on}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.linen-muted}"
  button-ghost-hover:
    backgroundColor: "{colors.linen-muted}"
    textColor: "{colors.espresso-ink}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
    height: "44px"
  chip-filter:
    textColor: "{colors.dust-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "36px"
  chip-filter-active:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.terracotta-ink-on}"
  card-place:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.2xl}"
    padding: "12px"
  nav-tab-active:
    textColor: "{colors.terracotta}"
    typography: "{typography.label}"
    height: "60px"
  map-pin:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.terracotta-ink-on}"
    rounded: "{rounded.full}"
    size: "36px"
  map-pin-active:
    size: "44px"
---

# Design System: PlaceMates

## Overview

**Creative North Star: "The Friends' Atlas"**

PlaceMates looks like a private atlas kept by a group of friends: cartography on one side, editorial typography on the other. The ground is warm paper (never white-on-grey), the ink is espresso, and a single terracotta pigment marks everything that belongs to *us* — the active tab, the pins on the map, the primary action. Contour lines and a compass mark carry the cartographic thread; Fraunces headlines with a mono eyebrow carry the editorial one, so every screen reads as if written by the same hand.

The mood is warm, personal and cartographic. It is a phone-first tool used outdoors, so density is moderate, targets are generous (44px minimum on primary controls, 60px tab bar) and every tap answers with a small physical response. Components are warm and tactile: soft generous corners, press-to-shrink feedback, flat on the page and lifted only when they float above the map.

Confirmed rejections: it must never feel like a utilitarian map tool (cool grey-blue Google-Maps neutrality) and never like generic SaaS (purple gradients, glassmorphism, cards-in-cards, dashboard chill).

**Key Characteristics:**
- Warm paper ground with a faint dot grain; espresso ink, never pure black.
- One terracotta accent for "ours / active / go"; state colours appear only on map pins.
- Fraunces display + Outfit body + Geist Mono eyebrows.
- Cartographic signatures: CompassMark, self-drawing TopoLines, warm basemap.
- Flat in the page, lifted over the map.
- Tactile motion: press-scale, short fades, reduced-motion fully honoured.

## Colors

A warm, low-chroma paper-and-ink palette with one earthy pigment; all values are authored in OKLCH in `src/app/globals.css` and that file is canonical.

### Primary
- **Terracotta** (`terracotta`): the one voice of the app. Primary buttons, active filter chips, the active bottom-nav tab and its pill (at 12% alpha), default map pins, focus rings (at 50%), the eyebrow text (at 80%), and the PWA theme colour. In dark mode it brightens to **Night Terracotta** (`night-terracotta`) so it keeps contrast on near-black.
- **Paper on Terracotta** (`terracotta-ink-on`): text and icons placed on terracotta — the paper colour itself, not white.

### Secondary
- **Apricot Highlight** (`apricot-highlight`): hover/pressed wash on list cards (`accent` at 40–50%) and accent surfaces; the warm "touched" state.
- **Sand Wash** (`sand-wash`): secondary buttons and quiet filled surfaces.

### Tertiary (map-pin states only)
- **Favourite Rose** (`pin-favorite-rose`): personal favourites on the map and the favourite heart.
- **Wishlist Emerald** (`pin-wishlist-emerald`): personal "I want to go".
- **Group Sky** (`pin-group-sky`): group "we should go".
- **Star Amber** (`star-amber`): rating stars only.

### Neutral
- **Paper** (`paper`): page background and sticky chrome (header, bottom nav — solid, never blurred).
- **Card White** (`card-white`): cards, popovers and map controls sitting on paper.
- **Espresso Ink** (`espresso-ink`): all body text and headings.
- **Dust Text** (`dust-text`): secondary text, inactive tabs and chips, italic ledes.
- **Linen Muted** (`linen-muted`): hover fills on ghost/outline buttons and chips.
- **Map Edge** (`map-edge`) / **Field Edge** (`field-edge`): hairline borders and input strokes.
- **Brick Alert** (`brick-alert`): destructive actions, rendered as a 10% tint with brick text rather than a solid red slab.
- **Night Paper / Night Card / Night Ink** (`night-paper`, `night-card`, `night-ink`): the dark theme keeps the same warm hue family (hue 55–80) instead of switching to neutral grey; borders become 8% white.

### Named Rules
**The One Pigment Rule.** Terracotta is the only accent in the chrome. Rose, emerald and sky exist to tell pin states apart on the map and in their matching hearts/toggles — never as decoration elsewhere.

**The Warm Ink Rule.** No pure black and no cool grey. Every neutral sits on hue 50–80 with a trace of chroma; the dark theme stays warm too.

## Typography

**Display Font:** Fraunces (variable, SOFT + opsz axes, roman and italic; ui-serif, Georgia fallback)
**Body Font:** Outfit (400/500/600; ui-sans-serif, system-ui fallback)
**Label/Mono Font:** Geist Mono

**Character:** A soft, slightly old-style serif for names of places and page titles against a clean geometric sans for everything you operate. The serif is the atlas; the sans is the tool.

### Hierarchy
- **Display** (Fraunces 400, 1.875rem → 2.25rem from `sm`, line-height 1.05, tight tracking): the EditorialHeader page title.
- **Headline** (Fraunces 400, 1.5rem, 1.15): section headings (`h2`).
- **Title** (Fraunces 400, 1.125rem, 1.25): place names on cards and sheets, truncated to one line.
- **Body** (Outfit 400, 0.875rem; inputs 1rem on mobile to avoid iOS zoom): running text. Ledes and empty-state copy are set in *italic* Dust Text, max ~42rem.
- **Label** (Outfit 500, 0.75rem): buttons, chips, tab labels. Tiny stat captions use 10px uppercase with wide tracking.
- **Eyebrow** (Geist Mono 10px, 0.32em tracking, uppercase, Terracotta at 80%, prefixed with an em dash "— "): the line above every editorial title.

### Named Rules
**The Same Hand Rule.** Every top-level page opens with the editorial trio: mono eyebrow → Fraunces title → optional italic lede. Don't invent a different header shape for a new page.

**The Serif Names Places Rule.** Place names and page titles are Fraunces; numbers, controls and metadata are Outfit with `tabular-nums` for scores.

## Layout

Mobile-first single column. Content sits in a centred column capped at `max-w-2xl` (42rem) with 16px page padding; the bottom nav caps at `max-w-xl`. The map is full-bleed edge to edge, with chrome floating over it.

Fixed frame: a sticky solid header (with `env(safe-area-inset-top)` padding) and a fixed 60px bottom nav (plus `env(safe-area-inset-bottom)`) with five tabs — Mapa, Miejsca, Plany, Ranking, Ja. Floating map UI (filter bar, MapLibre controls at 60px below the safe top, speed dial, preview sheet) is offset to clear both.

Rhythm: 4px base; 8px/12px inside components, 12px between list cards, 16px page gutters, 24px between sections. Horizontal chip rows scroll with hidden scrollbars and an 8px soft mask at each edge. Bottom sheets (vaul) are the default container for secondary tasks on mobile.

## Elevation & Depth

Hybrid. Inside the page the system is flat: surfaces separate by a hairline border or a 1px `foreground/10` ring and by the paper-to-card-white step. Shadows appear only on things that float above the map or the page — pins, the filter bar, map controls, install prompt, sheets and the photo hero.

### Shadow Vocabulary
- **Pin lift** (`shadow-md` + 2px paper-white border): every map pin and cluster.
- **Floating bar** (`shadow-md`, 90% paper with backdrop blur): the filter pill bar over the map.
- **Map control** (`box-shadow: 0 2px 10px oklch(0 0 0 / 0.12)`): MapLibre zoom/locate group, re-skinned as a pill.
- **Active chip glow** (`shadow-sm` tinted `primary/30`): the selected filter chip.
- **Hero drop** (`box-shadow: 0 30px 80px -40px oklch(0 0 0 / 0.5)`): large photo/place heroes and the share card.
- **Pulse ring** (keyframe `pm-pulse-ring`, terracotta 45% → 0, 12px spread): live "you are here"/attention beacons.

### Named Rules
**The Float Rule.** Only things that sit above the map or above the page get a shadow. A card in a list never does.

## Shapes

Soft and generous, built from one `--radius` of 0.75rem: buttons and inputs at `lg`, place cards and sheets at `2xl`, large heroes at `3xl`. Anything you tap on the map or in a chip row is a full pill or circle — pins, clusters, filter chips, the filter bar, the map-control group, the active-tab indicator. Compact buttons cap their radius at 10–12px so small sizes don't become blobs. The CompassMark (circle, four-point star, offset north) and the contour-line paths are the only illustrative shapes.

## Components

### Buttons
Warm and tactile: they press down rather than glow.
- **Shape:** gently rounded (`rounded.lg`), 44px tall by default (`lg` 48px, `sm` 36px, `xs` 32px); icon buttons 44×44.
- **Primary:** Terracotta fill with paper text, label type, 16px horizontal padding.
- **Hover / Focus / Active:** links darken to `primary/80`; focus shows a 3px ring at 50% Terracotta; pressing nudges the button down 1px. Disabled at 50% opacity.
- **Outline / Ghost / Secondary:** outline is a paper button with a hairline border that fills Linen on hover; ghost is bare until hover; secondary uses Sand Wash.
- **Destructive:** 10% Brick tint with Brick text, 20% on hover.

### Chips
- **Style:** 36px full pills, 12px label, inactive in Dust Text with a Linen hover fill.
- **State:** active becomes solid Terracotta with paper text and a terracotta-tinted small shadow; press scales to 0.97. Chips usually live inside a floating pill bar on the map.

### Cards / Containers
- **Corner Style:** `rounded.2xl` for place cards, `rounded.xl` for generic cards.
- **Background:** Card White on Paper.
- **Shadow Strategy:** none (see The Float Rule).
- **Border:** hairline Map Edge, or a 1px `foreground/10` ring on shadcn cards.
- **Internal Padding:** 12px on place cards, 16px on generic cards.
- **Interaction:** whole card is the link; hover/pressed wash in Apricot Highlight, press scales to 0.985.

### Inputs / Fields
- **Style:** 44px, transparent fill on paper, Field Edge stroke, `rounded.lg`, 14px horizontal padding, 16px text on mobile.
- **Focus:** border shifts to Terracotta ring colour plus a 3px soft ring (25–40%).
- **Error / Disabled:** Brick border with a 20% Brick ring; disabled at 50% with a muted fill. Native `select`/`textarea` share the same look through the `field-base` utility.

### Navigation
- **Bottom nav:** five equal tabs, 60px tall, solid Paper with a top hairline (no blur, so view-transition snapshots stay crisp). Icon 22px over label 12px. Inactive in Dust Text; active in Terracotta with a 2.25 stroke, medium label weight and a 48×28 pill at 12% Terracotta behind the icon. Tabs press-scale to 0.9.
- **Header:** sticky, solid Paper, bottom hairline, safe-area aware, anchored across view transitions.

### Map Pins (signature)
- 36px terracotta circle with the category's Lucide glyph in paper, a 2px white border and `shadow-md`, lifted 4px. Selected pins grow to 44px with a 4px ring at 30% of their own colour.
- State colours: favourite → Rose, personal wishlist → Emerald, group to-visit → Sky, otherwise Terracotta. Pins animate in with `pm-marker-in` (scale 0.6 → 1).
- In dark mode the basemap canvas alone is inverted and hue-rotated; pins and controls keep their true colours.

### Editorial Header (signature)
Mono eyebrow with an em-dash prefix in Terracotta, Fraunces display title, italic Dust lede, optional trailing action. Used across top-level pages and auth screens; server-rendered and static.

### Contour Lines & Compass (signature)
TopoLines: a few smooth bezier contours at low Terracotta opacity that draw themselves in over ~2.8s (staggered 120ms), faded at both horizontal ends — used behind auth and public share screens. CompassMark: the brand glyph, inline before the wordmark, as a watermark, and as the app icon.

## Do's and Don'ts

### Do:
- **Do** keep Terracotta as the single accent for active, selected and primary states.
- **Do** open every top-level page with the eyebrow → Fraunces title → italic lede trio.
- **Do** give every tappable thing at least 44px and a physical press response (`active:scale-90` on tabs, 0.97 on chips, 0.985 on cards, 1px nudge on buttons).
- **Do** keep sticky chrome solid Paper; reserve backdrop blur for bars floating over the map.
- **Do** keep motion short and opacity-led (180ms view transitions, 400ms fade-up with 55ms stagger, 460ms `cubic-bezier(0.16, 1, 0.3, 1)` content rise) and leave the global reduced-motion override intact.
- **Do** use `tabular-nums` for scores, counts and averages.

### Don't:
- **Don't** make it look like a utilitarian map tool: no cool grey-blue neutrals, no default basemap chrome, no unstyled MapLibre controls.
- **Don't** drift into generic SaaS: no purple or multi-stop gradients, no glassmorphism panels, no cards inside cards, no dashboard-grey surfaces.
- **Don't** use rose, emerald or sky outside pin states and their matching toggles.
- **Don't** add shadows to in-page cards or list rows.
- **Don't** use pure black, pure white text on terracotta, or `font-bold`; weight tops out at 600 in Outfit, and Fraunces carries emphasis through size.
- **Don't** apply `transform` to route-level wrappers; it breaks the map's fixed overlays and the sticky header.
