# Bet Slip Footer Redesign — Design

## Problem

The expanded bet slip sheet (`.modal-inner` in `src/components/Home.astro`,
behavior in `src/scripts/betSlip.js`) ends in a single plain sentence —
`"Multiplier: 2.0x — Potential winnings: 15 units"` — below a raw
`<input type="number">` for stake. The user wants this area redesigned to
read more like a modern prop-picking app (reference: Underdog Fantasy's bet
slip — multiplier badge, `"$X pays $Y"` line, `+$1/+$5/+$10` quick-add
stake chips, full-width submit button). Confirmed with the user: redesign is
scoped to this footer only — the `"Your Picks"` header and the plain-text
pick rows above it (`.bet-slip-leg`) are unchanged. Confirmed: keep "units"
terminology (not "$", which the rest of the app never uses — this is
bragging-rights units, not real money) and the existing dark palette from
`DESIGN.md` (not the reference's light theme).

## Decisions

- **One stake input replaces two.** Today's code has two separate stake
  input paths that are functionally the same value: a `.leg-stake` input
  injected into the single leg row when mode is `"single"` (which — per
  `currentMode()` — only ever happens with exactly one pick), and a
  separate `#parlayStake` input shown when mode is `"parlay"` (two or more
  picks). Since exactly one of these is ever visible at a time and both
  drive the same "total stake" concept, they collapse into one input,
  `#stakeInput`, that lives in the new footer and is always present
  once at least one pick is selected — regardless of mode. `renderLegs()`
  no longer injects a per-leg stake input; `updateSummary()` and the
  `placeBetBtn` submit handler both read the one `#stakeInput` value
  (used as each leg's `stake` for `mode: "single"`, or as the whole
  parlay's `stake` for `mode: "parlay"`).
- **Footer layout, top to bottom:**
  1. **Multiplier + payout row** (`.bet-slip-footer-summary`): a pill badge
     on the left showing the multiplier as `${multiplier.toFixed(1)}x`
     (same one-decimal formatting the mini-bar and today's summary sentence
     already use), and text on the right reading `{stake} units pays
     {payout} units` (`payout` is the existing `Math.round(stake *
     multiplier * 100) / 100` calculation, unchanged). This splits today's
     one-sentence summary into the reference's two-element layout.
  2. **Stake row** (`.bet-slip-stake-row`): three quick-add chips —
     `+5`, `+10`, `+25` — followed by `#stakeInput`, all in one horizontal
     flex row (chips fixed-width, input flexes to fill remaining space).
  3. **Place Bet button** (`#placeBetBtn`, existing element, unchanged
     text/id) — full width, keeps its current base `button` styling
     (Trophy Gold), which already matches the reference's yellow "Play"
     button with no color change needed.
  `#bet-slip-error` keeps its current position, directly below the button.
- **Chips are additive, not presets.** Clicking `+10` adds 10 to whatever
  `#stakeInput` currently holds (parses current value as `Number(...) || 0`,
  adds the chip's value, writes it back, then fires the same `input` logic
  `updateSummary()` already listens for). Clicking `+5` then `+10` yields a
  stake of 15. This matches the reference's `+` prefix literally.
- **No new visual language.** Multiplier badge and chips reuse the existing
  pill pattern (`--radius-pill`, same visual weight as `.bet-mode-label`
  and `.sport`) and existing color tokens (`--highlight-color` for the
  active/CTA elements, `--secondary-text`/`--primary-text` for labels) —
  nothing from `DESIGN.md` changes, no new tokens are introduced.
- **No settings gear / info-icon tooltip.** The reference's gear icon (top
  header) and the ⓘ next to `"$X pays $Y"` have no corresponding feature in
  this app (no bet-slip settings, no existing tooltip component) — omitted
  rather than adding UI that does nothing.
- **Mobile-first, same breakpoint as today.** The footer sits inside the
  existing `.modal-inner`, which is already full-width under 640px and
  capped at `480px` above it (`src/styles/global.css:513-522`) — the chip
  row wraps to that same container, no new breakpoint needed. On very
  narrow viewports the three chips shrink before the input does (`flex-shrink`
  on chips, `flex: 1` on the input) so the row never overflows.

## Markup change

```html
<!-- src/components/Home.astro — replaces the #parlay-stake-wrap block and
     .bet-slip-summary paragraph -->
<div class="bet-slip-footer" id="bet-slip-footer" hidden>
  <div class="bet-slip-footer-summary">
    <span class="bet-slip-multiplier" id="bet-slip-multiplier">1.0x</span>
    <span class="bet-slip-payout-line" id="bet-slip-payout-line">0 units pays 0 units</span>
  </div>
  <div class="bet-slip-stake-row">
    <button type="button" class="stake-chip" data-add="5">+5</button>
    <button type="button" class="stake-chip" data-add="10">+10</button>
    <button type="button" class="stake-chip" data-add="25">+25</button>
    <input type="number" id="stakeInput" min="1" step="1" placeholder="units" />
  </div>
</div>
```

`#bet-slip-footer` replaces `#parlay-stake-wrap` and `#bet-slip-summary`;
`renderLegs()` unhides it whenever `picks.length > 0` (previously
`parlayStakeWrap.hidden = mode !== "parlay"` only unhid it in parlay mode —
now it's mode-independent). `.bet-mode-label` (the `"Individual bet"` /
`"Parlay — N picks"` pill) stays exactly where it is today, above this block.

## Explicitly out of scope (YAGNI)

- Restyling the pick rows (`.bet-slip-leg`) into mini prop cards — footer
  only, per the confirmed scope.
- The reference's settings gear icon and info-tooltip — no backing feature.
- Any change to the collapsed mini-bar (`.open-modal`, `#betslip-count`,
  `#betslip-payout`) — that already shows a live multiplier and is
  untouched by this work.
- Any change to `src/lib/bets.ts` or `/api/bets` — the request body shape
  (`{mode, stake, picks}` for parlay, `{mode, picks: [{propId, pick,
  stake}]}` for single) is unchanged; only how the client reads the stake
  value before building that body changes.
- A "$" display mode toggle — units only, per the confirmed decision.

## Files touched

- **Modify** `src/components/Home.astro` — replace `#parlay-stake-wrap` +
  `.bet-slip-summary` markup with the `#bet-slip-footer` block above.
- **Modify** `src/scripts/betSlip.js` — remove per-leg stake input from
  `renderLegs()`; add chip click handlers; update `updateSummary()` to
  read `#stakeInput` unconditionally and write the split multiplier-badge
  / payout-line text instead of one sentence; update `placeBetBtn`'s
  submit handler to read `#stakeInput` for both modes.
- **Modify** `src/styles/global.css` — replace `.bet-slip-summary` and any
  `#parlay-stake-wrap`-specific rules with `.bet-slip-footer`,
  `.bet-slip-footer-summary`, `.bet-slip-multiplier`, `.bet-slip-payout-line`,
  `.bet-slip-stake-row`, `.stake-chip` rules; `.leg-stake`/`#parlayStake`
  combined selector (lines 201-213) becomes `#stakeInput` alone.
