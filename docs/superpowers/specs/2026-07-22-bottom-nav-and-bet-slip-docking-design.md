# Bottom Nav + Bet-Slip Docking — Design

## Problem

The app has no persistent, sitewide navigation to the four core destinations a user
moves between: player props, their bets, the leaderboard, and their account. Today
there's only a desktop-style top `Nav.astro`/`Header.astro` (brand, a conditional "My
Bets" link, an account dropdown), and it isn't even present on every page. Two of the
four destinations — leaderboard and account — don't exist as routes yet.

Separately, the bet-slip summary bar (`.open-modal`, the collapsed "X Picks · payout"
strip that appears once a user starts building a bet) is pinned to `bottom: 0` with
nothing below it. Once a persistent bottom nav exists, the bet slip needs to dock
directly above it instead of overlapping it.

## Decisions

- **New `<BottomNav />` lives in `Layout.astro`**, not added page-by-page. It's the
  single shared layout every public page already renders through (or will, after the
  Home.astro cleanup below), so this is the only way to guarantee every current and
  future public page gets it without relying on each page remembering to include it.
  Skipped for `/admin/*` routes via a pathname check.
- **Persistent on all screen sizes**, coexisting with the existing top nav — not a
  mobile-only tab bar that hides on desktop. The existing top nav/account dropdown are
  untouched.
- **Four tabs, fixed set**: Props (`/`), My Bets (`/my-bets`), Leaderboard
  (`/leaderboard`), Account (`/account`). Active tab is whichever matches
  `Astro.url.pathname`, styled in `--highlight-color`/`--primary-text`; inactive tabs
  in `--secondary-text` — mirrors the reference image's black-vs-gray active/inactive
  treatment.
- **Icons are small inline stroke SVGs**, hand-written directly in the component. No
  icon library dependency — the codebase has none today and one four-icon nav doesn't
  justify adding one.
- **Leaderboard and Account are real, minimal pages, not stubs.** Both routes render
  actual content using data access that already exists (`listAllUsers`), not a "coming
  soon" placeholder:
  - `/leaderboard`: public (no login required, same as `/` and `/leagues/[sport]`).
    Lists all users sorted by `units` descending — a plain ranked list (rank, avatar,
    username, units), no pagination or time-windowing.
  - `/account`: auth-gated. Redirects to `/login` if `!Astro.locals.user`, exactly
    like `/my-bets` does today. Shows the current user's avatar (or placeholder),
    username, units balance, and the existing log-out form
    (`POST /api/auth/logout`).
- **Bet-slip docking is pure CSS.** `BottomNav.astro`'s root element publishes its
  rendered height as `--bottom-nav-height` (a CSS custom property set inline via
  `style` from a fixed constant, not measured with JS — see Implementation notes).
  `.modal-div`'s `bottom: 0` becomes `bottom: var(--bottom-nav-height)`. No JS
  changes: `betSlip.js` already toggles `.open-modal.visible` based on whether the
  user has an active selection; it just now sits in a different vertical slot.
- **Home.astro cleanup, folded into this work.** `Home.astro` currently renders its
  own `<html><head><body>` even when nested inside `<Layout>` (via `index.astro` and
  `leagues/[sport].astro`), producing duplicate document shells. This has to be fixed
  as part of adding `BottomNav` to `Layout.astro`, because otherwise pages that render
  `<Home />` would get two conflicting `<body>` elements — one from `Layout` (with the
  new bottom nav) and one from `Home` (without it), and the bet slip's CSS variable
  lookup would be ambiguous about which `<body>`/document it's scoped to.
  - `Home.astro` becomes a fragment: no `<html>`, `<head>`, or `<body>` tags. Keeps
    its Beams background, `<Header />`, prop grid, and bet-slip modal markup as-is.
  - Its four `<script type="module">` tags (`modal.js`, `buttonColor.js`,
    `betSlip.js`, `profileCardTilt.js`) move to be declared by the pages that render
    `<Home />` — `index.astro` and `leagues/[sport].astro` — the same way
    `admin/props.astro` already declares its own scripts above `<Layout>`.
  - The `data-logged-in` attribute `betSlip.js` reads via `document.body.dataset` was
    on Home's own `<body>`; it moves to `Layout.astro`'s `<body>`, computed the same
    way (`Astro.locals.user ? "true" : "false"`) since `Astro.locals` is available in
    every server-rendered Astro component for the same request.
  - `<meta name="viewport">` and the global stylesheet `<link>` that Home.astro
    duplicated are dropped — `Layout.astro` already provides both.

## Explicitly out of scope (YAGNI)

- Any leaderboard filtering, time windows (weekly/monthly), or pagination — a flat
  all-time ranked list only.
- Editing account details (username, password, avatar) from `/account` — this page
  only displays info and lets the user log out. Editing is a separate feature.
- Hiding/disabling the My Bets or Account tabs when logged out. Clicking them while
  logged out simply hits the existing redirect-to-login behavior (`/my-bets` already
  does this; `/account` gains the same guard) — no special-casing in `BottomNav`
  itself.
- Changing anything about the existing top `Nav.astro`/`Header.astro` or the account
  dropdown menu within it.
- Making the bottom nav collapse/hide on scroll, or any scroll-driven show/hide
  behavior — always visible, per the reference image.
- An icon library dependency (Lucide, Feather, etc.) — hand-written inline SVGs only.

## Files touched

- **New** `src/components/sub_components/BottomNav.astro` — the 4-tab bar.
- `src/layouts/Layout.astro`:
  - Renders `<BottomNav />` after `<slot />`, skipped when
    `Astro.url.pathname.startsWith("/admin")`.
  - `<body data-logged-in={Astro.locals.user ? "true" : "false"}>` (moved from
    Home.astro).
- `src/components/Home.astro` — drop `<html>/<head>/<body>` wrapper and duplicated
  `<meta viewport>`/stylesheet `<link>`; becomes a fragment. Drop its four
  `<script>` tags (moved to callers).
- `src/pages/index.astro` — add the four `<script type="module">` tags above
  `<Layout>` for the logged-in (`<Home />`) branch, matching the
  `admin/props.astro` pattern.
- `src/pages/leagues/[sport].astro` — same four `<script>` tags added above
  `<Layout>`.
- `src/styles/global.css`:
  - New `.bottom-nav`, `.bottom-nav-tab`, `.bottom-nav-tab.active` (or similar)
    rules, using existing tokens (`--secondary-bg`, `--space-*`, `--radius-*`,
    `--highlight-color`, `--secondary-text`).
  - `--bottom-nav-height` custom property (declared alongside the other `:root`
    tokens or set inline on `.bottom-nav`).
  - `.modal-div` changes `bottom: 0` → `bottom: var(--bottom-nav-height)`.
- **New** `src/pages/leaderboard.astro` — public, renders `listAllUsers()` sorted by
  `units` descending.
- **New** `src/pages/account.astro` — auth-gated (redirect to `/login`), renders the
  current user's info + existing logout form.

## Implementation notes

- `--bottom-nav-height` is a static value (e.g. `64px` desktop, adjusted for
  `env(safe-area-inset-bottom)` on iOS) declared as a CSS custom property — not
  measured via JS/ResizeObserver. The nav's content (icon + label, padding) is fixed
  and doesn't reflow based on data, so a static height is safe and avoids adding a
  runtime layout-measurement dependency for a single always-known value.
- `BottomNav.astro` determines the active tab by comparing `Astro.url.pathname`
  against each tab's `href` (exact match for `/`, prefix match for the others e.g.
  `/my-bets` also matches sub-paths if any exist later).
- No changes to `betSlip.js`, `myBets.js`, or any API route — this is a
  navigation/layout/CSS feature plus two new read-only pages built entirely on
  existing `lib/users.ts` and `lib/bets.ts` functions.
