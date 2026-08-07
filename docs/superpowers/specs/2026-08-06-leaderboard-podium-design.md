# Leaderboard Podium — Design

## Problem

The Leaderboard page (`/leaderboard`) currently renders every ranked user as
a uniform list row, with no visual distinction for the top 3 beyond a
colored rank badge. The request is to make the top 3 the main focus of the
page via a classic 3-column podium (1st tallest/center, 2nd next-tallest,
3rd shortest), with everyone else continuing in the existing list format
below it. A reference image was supplied (Apple Games' "you are the
winner" hero card — one large focal avatar with two smaller avatars
offset behind it); after discussion, the user confirmed they want the
literal stepped-height 3-column podium their text described, not that
hero-card pattern, since "1st highest, 2nd next highest, 3rd lowest"
specifically describes riser-block heights.

## Decisions

- **Presentation-only change.** `computeStandings()` (`src/lib/standings.ts`)
  already returns a fully-sorted `StandingRow[]` with every field a podium
  needs (avatar, name, net units, W-L-P, streak). No new lib functions, no
  new API routes, no schema changes.
- **Podium renders only with 3+ standings rows.** With 0–2 rows, skip the
  podium entirely and fall back to today's behavior unchanged: the plain
  list (which already handles 1–2 rows fine) or the existing "No settled
  bets yet…" empty state at 0. No partial/2-block podium — confirmed with
  the user.
- **Podium replaces the list rows for ranks 1–3, not duplicates them.**
  When the podium renders, the list below starts at rank 4
  (`standings.slice(3)`). "Every other user" in the request means ranks
  4+, so the top 3 appear exactly once on the page.
- **Visual order is 2nd–1st–3rd, left to right** — the universal podium
  convention — regardless of the underlying array order, which stays
  1st/2nd/3rd (array index 0/1/2) for data clarity.
- **Riser height encodes rank**, using a colored base bar under each
  block: tallest under 1st, medium under 2nd, shortest under 3rd. Colors
  reuse the existing `--trust-rank-gold` / `--trust-rank-silver` /
  `--trust-rank-bronze` tokens (`trust-tokens.css`) — the same three colors
  `RankBadge` already uses for ranks 0–2 in the list, so the podium and the
  list-below read as one consistent color language, not two.
- **Podium card content: avatar, name, net units.** Confirmed with the
  user over "avatar/name only" (too sparse — net units is the one stat
  that actually explains *why* someone is in 1st) and "everything"
  (record + streak too — redundant with the list immediately below, and
  crowds a card that's meant to be a visual focal point, not a data table).
  Net units keeps the existing list's sign-based color convention
  (`--trust-positive` / `--trust-negative`) rather than forcing gold on all
  three, since a 1st-place net-units value is not guaranteed positive
  (e.g. a week where everyone is down, 1st is merely "least negative").
- **1st place gets a larger avatar than 2nd/3rd, plus a small crown glyph**
  above it, using the same stroke-icon visual style (`stroke="currentColor"`,
  `stroke-width="1.6"`) as every other icon in the app (league-tab icons,
  bottom-nav icons, etc.) — not a new icon style. Colored gold
  (`--trust-rank-gold`).
- **New sub-components live inside `StandingsBoard.tsx`**, not a new file.
  The file already holds several private, unexported helper components
  (`RankBadge`, `Avatar`, `StreakChip`, `PeriodToggle`, `CalloutCard`) for
  exactly this component; `Podium` and `PodiumBlock` follow the same
  pattern — inline `style` objects referencing the CSS custom properties,
  no CSS Modules/Tailwind/styled-components, consistent with the rest of
  the file and the original standings-badges spec's decisions.
- **No changes to the two callout cards** (Biggest Upset / Worst Beat) —
  out of scope, not mentioned in the request.

## Component API changes

`StandingsBoardProps` is unchanged — no new props needed. The split
between podium and list happens inside `StandingsBoard`'s render body:

```ts
const top3 = standings.length >= 3 ? standings.slice(0, 3) : null;
const listRows = top3 ? standings.slice(3) : standings;
```

New private sub-components (both internal to `StandingsBoard.tsx`, neither
exported):

```ts
function Podium({ top3 }: { top3: [StandingRow, StandingRow, StandingRow] }): JSX.Element

function PodiumBlock({
  row,
  rank,       // 0 | 1 | 2
  size,       // "lg" for rank 0, "sm" for ranks 1-2
}: {
  row: StandingRow;
  rank: 0 | 1 | 2;
  size: "lg" | "sm";
}): JSX.Element
```

`Podium` renders three `PodiumBlock`s in DOM order 2nd, 1st, 3rd (matching
the required left-to-right visual order without needing CSS `order`
tricks), each sized/colored by its own `rank`.

## Explicitly out of scope (YAGNI)

- Any new MongoDB collection, lib function, or API route.
- Sorting/ranking logic changes — `computeStandings` already sorts
  correctly; the podium only slices the first 3 of an already-sorted array.
- The Apple-reference hero-card pattern (single large focal avatar with
  offset avatars behind it) — explicitly declined in favor of the 3-column
  stepped podium.
- Animation/confetti on the podium — not requested; the existing
  `fireConfetti()` win-celebration script is unrelated (bet-slip wins on
  `my-bets`, not leaderboard rank).
- Changes to the Biggest Upset / Worst Beat callout cards.
- New fonts or colors beyond the existing gold/silver/bronze rank tokens.

## Files touched

- **Modified** `src/components/react/StandingsBoard.tsx` — add `Podium`
  and `PodiumBlock` private components; split `standings` into
  `top3`/`listRows` in the main render body.

No other files change. `standings.ts`, `StandingsBoardIsland.tsx`, and
`leaderboard.astro` are untouched — they already pass `standings` through
unmodified, which is all this feature needs.

## Verification

This codebase has no automated test framework. Verify with `npx astro
check` (0 errors required) plus manual browser verification against the
dev server, covering:
- 3+ users with settled bets → podium renders with correct 2nd-1st-3rd
  visual order, correct riser heights, correct avatar sizing (1st larger),
  crown on 1st only, list below starts at rank 4.
- Exactly 2 users → no podium, both render in the plain list (today's
  existing behavior, unchanged).
- 0 users → no podium, existing empty-state message.
- Toggling the "This week" / "Season" period re-computes and re-renders
  the podium correctly (it's driven by the same `standings` prop, so this
  should fall out for free, but confirm visually).
- A user with negative net units in the podium (if reachable with current
  seed data) renders that value in red, not gold.
