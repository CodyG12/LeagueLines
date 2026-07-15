# Design System — LeagueLines

## Product Context
- **What this is:** A player-props sports betting web app — pick overs/unders on real player stats, stack them into parlays, track units won/lost.
- **Who it's for:** Sports bettors who read the box score before the odds — friends betting bragging rights, not real money.
- **Space/industry:** Sportsbooks (DraftKings, FanDuel, Bet365 category).
- **Project type:** Web app (Astro + vanilla CSS), dark-first, session auth, admin panel.

## Aesthetic Direction
- **Direction:** Precision/Refined — Apple-level restraint applied to a sports betting product. Energy comes from color scarcity and confident numerals, not decoration.
- **Decoration level:** Intentional — the existing WebGL gradient backgrounds (Grainient, GradientBlinds, Lightfall) stay, recolored into the brand palette instead of generic pink/violet.
- **Mood:** Serious and precise, like a finance app — but still reads as sports because exactly one color (purple) is reserved for "live," making it feel electric by scarcity rather than everywhere.
- **Memorable thing:** Still feels like sports — energy, not just calm.

## Typography
- **Brand/Logotype:** Erica One — used ONLY for the "LeagueLines" wordmark (nav, hero). Nowhere else. Single weight (400); it's the one loud voice in an otherwise quiet system.
- **Display/Hero/Headlines:** General Sans — page titles, section headers, player names, hero copy. SF Pro–adjacent geometric warmth.
- **Body/UI/Labels:** Instrument Sans — body copy, labels, buttons, form fields. Quiet workhorse, disappears into content.
- **Data/Numerals:** Geist with `font-variant-numeric: tabular-nums` — every number sitewide: prop lines, unit counts, bet totals, payouts. One numeral treatment everywhere is what makes the whole site feel engineered, not assembled.
- **Loading:** Geist + Erica One via Google Fonts; General Sans + Instrument Sans via Fontshare (`api.fontshare.com`).
- **Scale (existing, kept):**
  - Hero/landing title: `clamp(2.4rem, 6vw, 3.8rem)` / 800 / `-0.02em`
  - Page title (`.title`): `2.1rem` / 800 / `-0.01em`
  - Player name (`.player`): `1.75rem` / 800
  - Stat value (`.value-stat`): `1.6rem` / 800, tabular-nums
  - Body: `1rem` / 400
  - Labels/eyebrows: `0.7–0.85rem` / 600–700, uppercase, tracked

## Color
- **Approach:** Restrained — one signature accent, one scarce accent, both used with a strict, single meaning each.
- **Canvas:** `#050506` (near-true black — engineered, not the previous purple-tinted `#0b0710`)
- **Surface:** `#151417` — cards, modals, nav dropdown
- **Primary text:** `#F5F5F7` (Apple's off-white — softer than pure white)
- **Secondary text:** `#98979D`
- **Trophy Gold** `#D4A72C` — *your money/action only*: CTAs, odds, active bet-slip states, key stat values. Refined from the previous neon `#F5C518` — desaturated so it reads trophy/premium, not casino-neon.
- **Match Purple** `#7C5CFC` — *live-game state only*: live badges, pulse dot, in-play indicators. Refined from `#8B5CF6`. Never used decoratively.
- **Win:** `#30D158` (Apple system green, dark mode)
- **Loss:** `#FF453A` (Apple system red, dark mode)
- **Dark mode:** Primary and only mode currently shipped. If light mode is added later, invert to bg `#F5F5F7` / surface `#FFFFFF` / text `#0A0A0C`, keep Gold/Purple as-is (both hold contrast on light).

## Spacing
- **Base unit:** 4px (unchanged — existing `--space-1` through `--space-7` scale: 4/8/12/16/24/32/48).
- **Density:** Comfortable.

## Layout
- **Approach:** Grid-disciplined (unchanged) — `repeat(auto-fit, minmax(300px, 1fr))` prop grid, `1200px` max content width.
- **Border radius:** Unchanged — sm 10px, md 16px, lg 24px, pill 999px.

## Motion
- **Approach:** Intentional — spring easing on hover/press (`--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`, unchanged), live-dot pulse, confetti on win, eased counter animation. All respect `prefers-reduced-motion`.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-14 | Initial design system created | `/design-consultation` — Apple-restraint direction for a sports betting product; user chose to keep sports energy via a scarce "live" accent rather than going fully minimal |
| 2026-07-14 | Erica One scoped to brand wordmark only | User tested it as the universal display font first, found it too loud sitewide; kept General Sans for all other headlines and confined Erica One to `LeagueLines` in nav/hero |
