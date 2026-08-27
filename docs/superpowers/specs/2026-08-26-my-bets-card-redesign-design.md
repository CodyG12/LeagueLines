# My Bets Card Redesign — Design

## Problem

`/my-bets` (`src/pages/my-bets.astro`) renders every bet — both the "Live Bets" and
"Past Bets" sections — as a plain `.card.admin-prop` block: a player name heading, a
one-line status/stake/payout sentence, then one bare `<p>` per leg reading
`"{player} — {pick} {line} {stat} ({legResult})"`. No photos, no visual sense of how
an individual leg resolved, no distinction between a bet still awaiting grading and
one that's settled beyond a small status-pill.

The user wants both sections redesigned to match a reference screenshot from a
prop-picking app ("Chalkboard"): a card per bet entry, headed by pick count/stake/
multiplier/outcome, with rich per-leg rows — player photo, name, a subtitle, the
pick/line/stat, and a graded-result indicator.

## Decisions

- **The reference's progress bar plots a real final stat value** ("55" landing past a
  "35.5" line) that this schema has never stored anywhere — a bet leg only ever
  tracked `legResult: pending | win | loss | push` (categorical), and even the prop
  itself never stored a final number (graded props are marked over/under/push, then
  deleted). Confirmed with the user: add a real `finalValue` field rather than fake a
  proportional bar or drop the element. The admin "Close & Grade" form gains an
  **optional** number input for it — not required, since forcing an exact number on
  every single grade would be a real workflow tax on top of today's one-click
  Over/Under/Push flow, and some props in this app are jokey ones ("Drinks Drunk")
  where the admin plausibly won't bother with an exact count. A leg graded without one
  still renders correctly (see "Progress bar rendering" below) — nothing is blocked
  on it.
- **Leg avatars use the same real-photo-or-sprite-fallback resolution `props.ts`
  already uses for prop cards**, not a sprite-only shortcut. `BetLeg` never captured
  `playerUserId` — confirmed with the user: copy it from the prop at bet-placement
  time (`placeBets()`), matching how a prop's `playerUserId` is itself an intentional,
  optional link (see the profile-pictures design doc). This keeps a bet card visually
  consistent with the prop card the user picked it from.
- **Leg subtitle is `"{sport} • {team}"` (or just `"{sport}"` with no team set),
  not a live-score/opponent line.** The reference shows `"ATL 133 vs. 134 DEN •
  Final"` — real score data this app has no model for at all (a prop has an optional
  free-text `team`, never an opponent or a score, and "sport" here is as often
  "Beer"/"Shots" as it is "NBA"). `BetLeg` didn't capture `team` either — confirmed
  with the user: capture it the same way as `playerUserId`, at bet-placement time.
- **No React island.** This page has zero interactivity — no clicks, no local state.
  Server-rendered Astro markup + CSS only, matching this codebase's own convention of
  reserving React islands for genuinely stateful widgets (`StandingsBoard`, `Badges`),
  not lists. `myBets.js`'s existing counter-animation and win-celebration confetti
  logic stays as-is, just retargeted at the new markup.
- **Progress bar is a decorative resolved/unresolved indicator, not a proportional
  plot.** Looking closely at the reference image, all three example legs render a
  *fully filled* bar regardless of how far the final value clears the line (55 vs.
  35.5 and 36 vs. 18.5 fill the bar identically) — it is not actually scaled to
  `finalValue / line`. Rendering it that way sidesteps ugly edge cases (a final value
  far past the line, or a `finalValue` of `null`) with no loss of fidelity to what the
  reference is actually doing: empty/muted track while a leg is `pending`; once
  graded, a full-width fill colored by that leg's own outcome (win/loss/push), with a
  trailing pill showing `finalValue` when the admin entered one, or a ✓/✕/= icon when
  they didn't.
- **Per-leg coloring is independent of the bet's overall status.** A parlay can have
  two already-graded legs and one still live; each leg row colors itself from its own
  `legResult`, not the parent bet's `status`.
- **The bet's overall pending/live state accents purple, not gold.** DESIGN.md
  reserves Match Purple strictly for live-game state, and the page's own "Live Bets"
  heading already uses purple for exactly this reason (`--accent-purple` gradient +
  live-dot). The new card's pending-state header amount follows that same rule. This
  is a deliberate choice to follow DESIGN.md's stated rule for *this new component*,
  not a claim that the sitewide `status-pill--pending`/`--live` classes (which
  currently render gold, elsewhere in the app) are being changed — they aren't, and
  that pre-existing inconsistency is out of scope here.
- **Drop the redundant overall status-pill.** Today's row shows a `status-pill--won`
  badge alongside a status sentence; the new header's colored outcome amount plus
  the Live/Past section it's already sitting in makes a separate text badge
  redundant.
- **Drop the raw "Entry #" line.** The reference shows an app-generated entry code;
  the closest equivalent here is a raw Mongo ObjectId, which isn't a meaningful
  number to a user. The footer keeps `"Placed {date}"` from `createdAt` only.

## Data model changes

`src/lib/bets.ts`:

- `BetLeg` (stored) gains three fields, all set once at `placeBets()` time:
  - `team: string | null` — copied from `prop.team`
  - `playerUserId: ObjectId | null` — copied from `prop.playerUserId`
  - `finalValue: number | null` — starts `null`, written only at grading time
- `PublicBetLeg` mirrors `team`, `playerUserId: string | null`, `finalValue`, plus a
  resolved-not-stored `playerAvatarUrl: string | null` (same pattern as
  `PublicPlayerProp.playerAvatarUrl`).
- `placeBets()`: each leg built from a prop copies `team: prop.team,
  playerUserId: prop.playerUserId ? new ObjectId(prop.playerUserId) : null,
  finalValue: null` alongside the fields it already copies.
- `settleBetsForProp(propId, result, finalValue: number | null = null)`: gains the
  third parameter. The existing per-leg `$set` that writes `legResult` on the
  matching leg (via `arrayFilters`) also writes `finalValue` on that same leg. One
  `finalValue` applies to every bet/leg referencing this prop, same as `legResult`
  already does.
- New private helper `attachLegAvatars(bets: PublicBet[]): Promise<PublicBet[]>` in
  `bets.ts`, structurally identical to `props.ts`'s `attachPlayerAvatars`: collects
  the distinct non-null `playerUserId`s across every leg of every bet in the list,
  one batched `users.find({ _id: { $in: [...] } })` query, falls back to
  `pickSpriteFor(leg.propId)` when there's no linked user or no avatar set. Called
  from `listBetsForUser` before returning.
- `toPublicBet` maps the new leg fields through unchanged (`team`, `playerUserId`,
  `finalValue`); avatar resolution happens as a separate batch pass afterward, same
  two-phase shape `props.ts` already uses.

`src/pages/api/admin/props/[id].ts`:

- `parseUpdateInput` accepts an optional `finalValue: number | null` in the request
  body. If provided, it must be a finite number (or `null`); no requirement that it
  be present when closing a prop.
- The `PATCH` handler passes `parsed.finalValue ?? null` through as the third
  argument to `settleBetsForProp`.

`src/pages/admin/props.astro` / `src/scripts/adminProps.js`:

- The `.close-form` (currently just a `result` select + submit button) gains
  `<input type="number" step="0.5" name="finalValue" placeholder="Final value (optional)">`
  between the select and the submit button.
- The form's submit handler reads `finalValue` from `FormData`, converts an empty
  string to `null` and anything else to `Number(...)`, and includes it in the PATCH
  body alongside `status`/`result`.

**Old bets** (placed before this ships) simply have `team`/`playerUserId`/
`finalValue` as `undefined`, treated as `null` throughout — no migration script,
matching this codebase's existing schemaless-missing-field convention (see the
profile-pictures design doc's same call for `avatarUrl`/`playerUserId`).

## Card layout

One `.bet-entry-card` per bet (a new class — the header/leg-rows/footer structure
here doesn't fit `.card`/`.admin-prop`'s flat shape, so it isn't a reskin of those).

**Header row:**
- Left: mode + count (`"Single Bet"` or `"{n}-Leg Parlay"`) above
  `"{stake} units @ {multiplier}x"` (`multiplier = potentialPayout / stake`, one
  decimal, tabular-nums via `--font-num` — same odds math `standings.ts` already
  does for `decimalOdds`).
- Right: the outcome amount, colored by `bet.status`:
  - `pending` → `"Potential +{potentialPayout - stake}"`, Match Purple
  - `won` → `"+{payout - stake}"`, `--success-color`
  - `lost` → `"-{stake}"`, `--danger-color`
  - `pushed` → `"Push · stake returned"`, `--secondary-text`

**Per-leg row** (left to right):
- Circular avatar (48px, `playerAvatarUrl` or sprite fallback)
- Name (`--font-display`, bold) + subtitle (`"{sport} • {team}"` or `"{sport}"`,
  `--secondary-text`, small)
- Right-aligned pick block: `"Over 35.5"` / `"Under 21"` (bold, colored by that leg's
  own `legResult`) with the stat label underneath (`--secondary-text`, small)
- Full-width bar beneath: empty/muted track while `legResult === "pending"`; once
  graded, a full-width fill in that leg's outcome color, with a trailing pill
  showing `finalValue` if present, else a ✓ (win) / ✕ (loss) / = (push) glyph

**Footer:** `"Placed {createdAt formatted as a date}"`. No entry-id line.

**JS:** no restructuring. `myBets.js` reads `#past-bets-data` JSON for the
win-celebration confetti/toast (unaffected by markup) and animates
`[data-animate-number]` spans (moves to wrap just the numeric portion of the new
header amount — same technique the bet-slip mini-bar already uses in
`src/components/Home.astro`).

## Explicitly out of scope (YAGNI)

- Any real live-score/opponent tracking — this app has no such data model and isn't
  gaining one for this feature.
- A mathematically proportional progress bar (`finalValue` plotted against `line`
  as a percentage) — decorative full/empty fill only, per the Decisions section.
- Requiring `finalValue` on every grade, or any UI to edit/correct a `finalValue`
  after the fact — it's set once, optionally, at grading time via the existing
  "Close & Grade" action.
- The raw bet ID / "Entry #" display.
- Any change to the bet-slip placement flow (`Home.astro`, `betSlip.js`) — this is
  entirely a display change for `/my-bets` plus the admin grading form's one new
  field.
- A React island for this page.
- Backfilling `team`/`playerUserId`/`finalValue` onto bets placed before this ships
  — they render with the null-handling paths described above, no migration script.

## Files touched

- **Modify** `src/lib/bets.ts` — `BetLeg`/`PublicBetLeg` new fields, `placeBets()`
  copies `team`/`playerUserId`, `settleBetsForProp()` gains `finalValue` param, new
  `attachLegAvatars()`, `listBetsForUser()` calls it.
- **Modify** `src/pages/api/admin/props/[id].ts` — `parseUpdateInput` accepts
  `finalValue`, `PATCH` passes it through.
- **Modify** `src/pages/admin/props.astro` — `.close-form` gains the `finalValue`
  input.
- **Modify** `src/scripts/adminProps.js` — close-form submit reads/sends
  `finalValue`.
- **Modify** `src/pages/my-bets.astro` — full card markup rewrite for both
  Live Bets and Past Bets sections.
- **Modify** `src/styles/global.css` — new `.bet-entry-card`/`.bet-entry-header`/
  `.bet-entry-leg`/progress-bar rules, using only existing DESIGN.md tokens
  (`--secondary-bg`, `--space-*`, `--radius-*`, `--font-display`/`--font-body`/
  `--font-num`, `--accent-purple`, `--success-color`, `--danger-color`,
  `--secondary-text`, `--primary-text`).
- **No change** `src/scripts/myBets.js` — confetti/counter logic is untouched;
  only the DOM it targets moves, via the same `#past-bets-data` / class hooks.

## Verification

This codebase has no automated test framework. Verify with `npx astro check`
(0 errors required) plus manual browser verification against the dev server:

- Place a single bet and a parlay; confirm both render correctly in Live Bets with
  the purple pending header and empty per-leg tracks.
- Grade one leg of a still-pending parlay (Close & Grade with a `finalValue` set);
  confirm that leg's row updates to a colored full bar + value pill while the rest
  of the parlay stays pending, and the bet stays in Live Bets until every leg is
  graded.
- Grade a prop **without** entering a `finalValue`; confirm the resulting bet leg
  renders a full colored bar with the ✓/✕/= glyph instead of a broken/empty pill.
- Grade a full bet to won/lost/pushed; confirm it moves to Past Bets with the
  correct colored header amount and confetti/toast still fires once for a new win.
- Confirm a leg linked to a registered user shows that user's real photo, and a
  free-text-player leg shows its deterministic sprite fallback.
- Confirm a bet placed before this ships (no `team`/`playerUserId`/`finalValue`)
  still renders without errors — sport-only subtitle, sprite avatar, graceful
  glyph-only progress pill if settled.
