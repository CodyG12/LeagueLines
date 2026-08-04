# Standings + Badges Components — Design

## Problem

Add two new, reusable React components — `StandingsBoard` and `Badges` — for a
friend-group standings/achievements feature. The request specified two CSS
token files (`trust-tokens.css`, `social-tokens.css`) and a visual language
(Space Grotesk/Inter/IBM Plex Mono, paper/ink surfaces, gold/silver/bronze
medals, flame accent) that doesn't exist anywhere in this repo (confirmed via
full history/branch search) and conflicts with the project's actual,
documented system (`DESIGN.md`: General Sans/Instrument Sans/Geist/Erica One,
single gold-accent-scarcity color approach). Confirmed with the user: build
the two token files, but reconcile their values into the real design system
rather than introducing a second visual language.

## Decisions

- **Token files alias real tokens, not new ones.** `src/styles/trust-tokens.css`
  and `src/styles/social-tokens.css` each declare a small set of
  purpose-named custom properties whose values are `var(--existing-token,
  fallback)` — e.g. `--trust-rank-gold: var(--highlight-color, #d4a72c);`.
  This satisfies "matching the existing design system" literally (same
  colors) while giving the two components a semantically-named API to
  consume. Genuinely new values only where DESIGN.md has no equivalent
  (silver/bronze medal colors) — chosen at the same desaturation level as
  the rest of the palette, not introducing new saturation/brightness.
- **No new fonts.** Components reference `var(--font-display)` (General
  Sans), `var(--font-body)` (Instrument Sans), and `var(--font-num)` (Geist,
  `font-variant-numeric: tabular-nums`) directly from `global.css` — every
  number (records, units, badge progress counters) uses `--font-num` per
  DESIGN.md's existing "one numeral treatment everywhere" rule. No Erica
  One (wordmark-only, per DESIGN.md).
- **Streak color reuses win/loss semantics, not a new "flame" hue.**
  DESIGN.md reserves purple for live-game state "never used decoratively."
  Win streaks use `--success-color` (green), loss streaks use
  `--danger-color` (red) — both already exist for exactly this kind of
  semantic distinction.
- **Components are pure/presentational — props in, JSX out.** No `fetch`,
  no state library, no data-fetching. `StandingsBoard` takes pre-sorted
  standings + the two callout cards as props; `Badges` takes a list of
  already-resolved earned/locked badge display objects. Rank is the array
  index — the component does not sort. This matches "framework-light,
  plain fetch/props" and keeps the components testable/reusable regardless
  of how a future page decides to fetch the data (Astro server-side
  `await`, a client `fetch`, etc.).
- **Badge definitions are code, not data.** `src/lib/badgeDefinitions.ts`
  exports a static `BadgeDefinition[]` (id, label, description, target,
  `progress(stats)`, `check(stats)`), operating on a `BadgeStats` shape.
  The `Badges` component itself never imports this file — a caller runs
  the definitions against a user's stats and passes the resulting
  `BadgeDisplay[]` down. This keeps the component ignorant of *what*
  badges exist, matching "no external state library" and "config, not DB."
- **Inline styles referencing the CSS custom properties**, per the request
  — no CSS Modules/styled-components/Tailwind. Both token files are
  plain `:root { --token: value; }` blocks loaded once (e.g. imported
  by whatever page renders these components); components read them via
  `style={{ color: "var(--trust-rank-gold)" }}`.
- **No new routes/pages/API endpoints.** The request asks for two
  components + a documented data contract, not a wired-up feature. Nothing
  is added to `src/pages/` as part of this work. Verified via a temporary
  local preview page, created and then deleted before finishing — it does
  not ship.

## Component APIs

```ts
// StandingsBoard.tsx
export type Period = "week" | "season";

export interface StandingRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  pushes: number;
  netUnits: number;
  streak: { type: "win" | "loss"; length: number } | null; // null/length<2 -> no chip
}

export interface UpsetCard {
  displayName: string;
  avatarUrl: string | null;
  odds: number;        // decimal multiplier, e.g. 7.2
  units: number;        // payout won
  description: string;  // e.g. "3-leg parlay"
}

export interface WorstBeatCard {
  displayName: string;
  avatarUrl: string | null;
  units: number;         // stake lost
  description: string;   // e.g. "Highest-payout bet of the week that fell through"
}

export interface StandingsBoardProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  standings: StandingRow[];       // pre-sorted by caller, rank = index
  upset: UpsetCard | null;
  worstBeat: WorstBeatCard | null;
}
```

```ts
// Badges.tsx
export interface BadgeDisplay {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  earnedOn: string | null;                       // ISO date, only when earned
  progress: { current: number; target: number } | null; // only when !earned
}

export interface BadgesProps {
  badges: BadgeDisplay[];
}
```

```ts
// badgeDefinitions.ts
export interface BadgeStats {
  totalBets: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  longestWinStreak: number;
  biggestUpsetOdds: number;
  seasonsPlayed: number;
  netUnitsAllTime: number;
}

export interface BadgeDefinition {
  id: string;
  label: string;
  description: string;
  target: number;
  progress: (stats: BadgeStats) => number;
  check: (stats: BadgeStats) => boolean;
}
```

## Explicitly out of scope (YAGNI)

- Any new MongoDB collection, lib function, or API route — the data-model
  notes describe how a *future* page would compute props for these
  components, but nothing here queries the real `bets`/`users` collections.
- Sorting/ranking logic inside `StandingsBoard` — caller's responsibility.
- Persisting or querying `user_badges` — described in a comment only.
- A literal numeric "biggest upset"/"worst beat" margin computed from
  actual final stat values — `PropDoc` only stores a categorical
  `result` (over/under/push), not the final stat number, so a true
  "lost by 0.5" margin isn't computable from today's schema. The data-model
  note documents this gap and gives both the schema addition that would
  fix it and a proxy that works today.
- New fonts, new hues, or any other deviation from `DESIGN.md`.

## Files touched

- **New** `src/styles/trust-tokens.css` — ledger surface/ink/rank-medal tokens.
- **New** `src/styles/social-tokens.css` — streak and badge-state tokens.
- **New** `src/components/react/StandingsBoard.tsx`
- **New** `src/components/react/Badges.tsx`
- **New** `src/lib/badgeDefinitions.ts`
- Data-model notes live as comments at the bottom of `StandingsBoard.tsx`
  and `Badges.tsx` respectively (per the request) — not a separate doc.

## Implementation notes (data model, summarized — full text goes in the file comments)

**Standings**, from the real `bets` collection (`userId, mode, legs[], stake,
potentialPayout, status, payout, createdAt, settledAt`):
- Scope by period: `week` = settled bets (`settledAt` set) within the
  current ISO week; `season` = all settled bets, or since a `SEASON_START`
  constant if/when the app defines seasons (no season concept exists in
  the schema today).
- Record: count of scoped bets per `status` (`won`/`lost`/`pushed`).
- Net units: `sum(payout - stake)` over scoped bets (`payout` is already 0
  for losses, per `computeFinalOutcome` in `bets.ts`).
- Rank: sort by net units desc (tie-break on win rate), index = rank.
- Streak: order a user's scoped bets by `settledAt` ascending, walk from
  the end collapsing the trailing run of `won`/`lost` (decide up front
  whether `pushed` breaks or is skipped — recommend skipped, matches most
  casual-league conventions).
- Biggest upset: among scoped `won` bets, `max(potentialPayout / stake)`.
- Worst beat: schema gap noted above — proxy as the scoped `lost` bet with
  the highest `potentialPayout`.

**Badges**, new `user_badges` table (rows only for *earned* badges):
```
user_badges { _id, userId (indexed), badgeId, earnedAt, statsSnapshot? }
```
- Locked/progress state is never stored — computed live from `BadgeStats`
  by running each `BadgeDefinition.progress()`/`check()`.
- Run badge checks in the same nightly job that grades/settles bets (today
  triggered per-prop from the admin "Close & Grade" action) — recompute
  `BadgeStats` per user once nightly, insert a `user_badges` row for any
  newly-`check()`-passing definition without an existing row for that
  user+badgeId. Do not compute on every page load — that would mean
  recomputing aggregate lifetime stats on every request.
