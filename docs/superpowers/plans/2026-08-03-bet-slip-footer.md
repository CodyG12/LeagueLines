# Bet Slip Footer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the bet slip's stake/payout footer to match a reference screenshot (multiplier badge, `"X units pays Y units"` line, `+5/+10/+25` quick-add stake chips, full-width Place Bet button), while collapsing today's two separate stake-input code paths (per-leg `.leg-stake` for single mode, shared `#parlayStake` for parlay mode) into one.

**Architecture:** Three tightly-coupled files change together: `src/components/Home.astro` (markup), `src/scripts/betSlip.js` (behavior), `src/styles/global.css` (visuals). Task 1 lands markup + behavior as one functional unit (the old two-stake-path code and the new one-stake-path code cannot coexist mid-refactor without breaking parlay betting, so they must ship together). Task 2 is pure CSS on top of Task 1's now-stable markup/IDs.

**Tech Stack:** Astro (`.astro` components), vanilla JS (no framework, re-inits on `astro:page-load` for View Transitions), vanilla CSS with custom properties (`src/styles/global.css`, tokens defined in `DESIGN.md`). No automated test framework in this repo — verification is `npx astro check`, `npx tsc --noEmit -p tsconfig.json`, `npx astro build`, and manual browser testing (Claude-in-Chrome tools) of the real interaction flow.

## Global Constraints

- Keep "units" terminology everywhere (never "$") — confirmed with the user, matches every other page in the app.
- No new CSS custom properties / colors — reuse existing `DESIGN.md` tokens only (`--highlight-color`, `--surface-2`, `--primary-text`, `--secondary-text`, `--font-num` with `tabular-nums`, `--radius-pill`, `--space-*`).
- Quick-add stake chips are **additive** (`+10` adds 10 to whatever's in the field), not presets that overwrite the field.
- Chip values: `+5`, `+10`, `+25` (confirmed with the user — not the reference's `+1/+5/+10`).
- Scope is the footer only: `.bet-slip-leg` rows, the `"Your Picks"` heading, `.bet-mode-label`, `#bet-slip-error`, and `#closeModal` are unchanged.
- No new settings/tooltip UI — the reference's gear icon and ⓘ have no backing feature in this app.
- `/api/bets`' request body shape is unchanged: `{mode:"parlay", stake, picks:[{propId,pick}]}` or `{mode:"single", picks:[{propId,pick,stake}]}` (see `src/pages/api/bets/index.ts:10-40`).
- Full spec: `docs/superpowers/specs/2026-08-03-bet-slip-footer-design.md`.

---

### Task 1: Unify the stake input and rewire the footer's behavior

**Files:**
- Modify: `src/components/Home.astro:105-114`
- Modify: `src/scripts/betSlip.js` (whole file, 244 lines)

**Interfaces:**
- Consumes: nothing from other tasks (first task).
- Produces (for Task 2's CSS to target): element IDs `#bet-slip-footer`, `#bet-slip-multiplier`, `#bet-slip-payout-line`, `#stakeInput`; class `.bet-slip-footer-summary`, `.bet-slip-stake-row`, `.stake-chip` (on 3 `<button>` elements with `data-add="5|10|25"`). `#placeBetBtn` and `#bet-slip-error` keep their existing IDs/classes, just move position relative to the new footer block.

- [ ] **Step 1: Replace the stake markup in Home.astro**

Open `src/components/Home.astro`. Find this block (lines 99-114):

```astro
      <h2>Your Picks</h2>
      <div id="bet-slip-legs"></div>

      <p class="bet-mode-label" id="bet-mode-label"></p>

      <div id="parlay-stake-wrap" hidden>
        <label for="parlayStake">Total stake</label>
        <input type="number" id="parlayStake" min="1" step="1" />
      </div>

      <p class="bet-slip-summary" id="bet-slip-summary"></p>
      <div id="bet-slip-error" class="form-error"></div>

      <button id="placeBetBtn" type="button">Place Bet(s)</button>
      <button id="closeModal" type="button" class="secondary-btn">Close</button>
```

Replace it with:

```astro
      <h2>Your Picks</h2>
      <div id="bet-slip-legs"></div>

      <p class="bet-mode-label" id="bet-mode-label"></p>

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

      <div id="bet-slip-error" class="form-error"></div>

      <button id="placeBetBtn" type="button">Place Bet(s)</button>
      <button id="closeModal" type="button" class="secondary-btn">Close</button>
```

- [ ] **Step 2: Rewrite `src/scripts/betSlip.js`**

Replace the entire file contents with:

```js
import { animateNumber } from "./animateCounter.js";

// Keep in sync with MAX_LEGS / parlayMultiplier in src/lib/bets.ts.
const MAX_LEGS = 10;
const LEG_ODDS = 21 / 11;

function parlayMultiplier(legCount) {
  const n = Math.min(Math.max(legCount, 0), MAX_LEGS);
  return Math.round(LEG_ODDS ** n * 2) / 2;
}

let lastMultiplierShown = 0;

// The delegated click listener below targets document, which persists across
// Astro View Transitions navigations (unlike the elements below it, which get
// torn down and recreated on every page swap) -- track it so re-running init()
// on each navigation replaces it instead of stacking duplicate listeners.
let delegatedClickHandler = null;

function init() {
  const openBtn = document.getElementById("openModal");
  const modal = document.getElementById("modal");
  const legsContainer = document.getElementById("bet-slip-legs");
  const betSlipFooter = document.getElementById("bet-slip-footer");
  const stakeInput = document.getElementById("stakeInput");
  const multiplierEl = document.getElementById("bet-slip-multiplier");
  const payoutLineEl = document.getElementById("bet-slip-payout-line");
  const betModeLabel = document.getElementById("bet-mode-label");
  const errorEl = document.getElementById("bet-slip-error");
  const placeBetBtn = document.getElementById("placeBetBtn");
  const betslipCountEl = document.getElementById("betslip-count");
  const betslipPayoutEl = document.getElementById("betslip-payout");
  const isLoggedIn = document.body.dataset.loggedIn === "true";

  if (!openBtn || !modal || !legsContainer) return;

  function getSelectedPicks() {
    const picks = [];
    document.querySelectorAll(".over-btn.selected, .under-btn.selected").forEach((btn) => {
      const prop = JSON.parse(btn.dataset.prop);
      const pick = btn.classList.contains("over-btn") ? "over" : "under";
      picks.push({ prop, pick });
    });
    return picks;
  }

  function deselectPick(propId, pick) {
    const btnClass = pick === "over" ? ".over-btn" : ".under-btn";
    const btn = Array.from(document.querySelectorAll(`${btnClass}.selected`)).find((el) => {
      try {
        return JSON.parse(el.dataset.prop).id === propId;
      } catch {
        return false;
      }
    });
    if (btn) btn.classList.remove("selected");
  }

  function syncOpenButtonVisibility() {
    const hasSelection = document.querySelector(".over-btn.selected, .under-btn.selected");
    openBtn.classList.toggle("visible", Boolean(hasSelection));
    if (!hasSelection) {
      modal.classList.remove("open");
    }
  }

  function currentMode() {
    return getSelectedPicks().length >= 2 ? "parlay" : "single";
  }

  function updateMiniBar() {
    if (!betslipCountEl || !betslipPayoutEl) return;
    const picks = getSelectedPicks();

    betslipCountEl.textContent = picks.length === 1 ? "1 Pick" : `${picks.length} Picks`;

    if (picks.length === 0) {
      betslipPayoutEl.textContent = "";
      lastMultiplierShown = 0;
      return;
    }

    const multiplier = parlayMultiplier(picks.length);
    animateNumber(betslipPayoutEl, lastMultiplierShown, multiplier, {
      duration: 400,
      suffix: "x",
      decimals: 1,
    });
    lastMultiplierShown = multiplier;
  }

  function updateSummary() {
    const picks = getSelectedPicks();

    if (picks.length === 0) {
      updateMiniBar();
      return;
    }

    const multiplier = parlayMultiplier(picks.length);
    const stake = Number(stakeInput.value) || 0;
    const potentialWinnings = Math.round(stake * multiplier * 100) / 100;

    multiplierEl.textContent = `${multiplier.toFixed(1)}x`;
    payoutLineEl.textContent = `${stake} units pays ${potentialWinnings} units`;
    updateMiniBar();
  }

  function renderLegs() {
    const picks = getSelectedPicks();
    const mode = currentMode();

    legsContainer.innerHTML = "";
    picks.forEach(({ prop, pick }) => {
      const row = document.createElement("div");
      row.className = "bet-slip-leg";

      const label = document.createElement("span");
      label.textContent = `${prop.player} — ${pick} ${prop.line} ${prop.stat}`;
      row.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "leg-remove-btn";
      removeBtn.setAttribute("aria-label", `Remove ${prop.player} pick`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        deselectPick(prop.id, pick);
        syncOpenButtonVisibility();
        renderLegs();
      });
      row.appendChild(removeBtn);

      legsContainer.appendChild(row);
    });

    if (betModeLabel) {
      betModeLabel.textContent =
        mode === "parlay" ? `Parlay — ${picks.length} picks` : "Individual bet";
    }

    betSlipFooter.hidden = picks.length === 0;
    updateSummary();
  }

  openBtn.addEventListener("click", () => {
    errorEl.textContent = "";
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    renderLegs();
  });

  stakeInput?.addEventListener("input", updateSummary);

  document.querySelectorAll(".stake-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const add = Number(chip.dataset.add) || 0;
      const current = Number(stakeInput.value) || 0;
      stakeInput.value = String(current + add);
      updateSummary();
    });
  });

  placeBetBtn?.addEventListener("click", async () => {
    errorEl.textContent = "";
    const picks = getSelectedPicks();

    if (picks.length === 0) {
      errorEl.textContent = "Select at least one pick first.";
      return;
    }

    const mode = currentMode();
    const stake = Number(stakeInput.value);
    let body;

    if (mode === "parlay") {
      body = {
        mode: "parlay",
        stake,
        picks: picks.map(({ prop, pick }) => ({ propId: prop.id, pick })),
      };
    } else {
      body = {
        mode: "single",
        picks: picks.map(({ prop, pick }) => ({ propId: prop.id, pick, stake })),
      };
    }

    const response = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      errorEl.textContent = data.error || "Something went wrong.";
      return;
    }

    window.location.href = "/my-bets";
  });

  // Keep the mini bar + sheet contents live as picks are made anywhere on the page,
  // not just when the sheet is opened.
  if (delegatedClickHandler) {
    document.removeEventListener("click", delegatedClickHandler);
  }
  delegatedClickHandler = (event) => {
    if (event.target.closest(".over-btn, .under-btn")) {
      renderLegs();
    }
  };
  document.addEventListener("click", delegatedClickHandler);
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
```

Note what changed vs. the original: `parlayStakeWrap`/`parlayStakeInput` element refs are gone, replaced by `betSlipFooter`/`stakeInput`/`multiplierEl`/`payoutLineEl`. `renderLegs()` no longer creates a `.leg-stake` input per leg — it only creates the label + remove button. `updateSummary()` always reads `stakeInput.value` (no more mode branch for where the stake comes from) and writes to `multiplierEl`/`payoutLineEl` instead of one `summaryEl` sentence. A new `.stake-chip` click handler adds to `stakeInput.value`. `placeBetBtn`'s handler reads `stakeInput.value` once and uses it for both request-body shapes (assigning it to every pick's `stake` in single mode, which is correct because single mode is only ever exactly one pick).

- [ ] **Step 3: Type-check and build**

Run: `npx astro check && npx tsc --noEmit -p tsconfig.json && npx astro build`
Expected: all three complete with 0 errors (this task touches no `.ts` files, but `astro check` also validates `.astro` files, and a broken `<script>` import would still fail the build).

- [ ] **Step 4: Manually verify in the browser**

Start the dev server if it isn't running (`npx astro dev`), then in a logged-in session on `/` (or any props page):

1. Click "Over" or "Under" on exactly one prop card. Confirm the bottom mini-bar becomes visible showing "1 Pick". Open it.
2. Confirm the sheet shows: the one pick's row, the mode label "Individual bet", then the new footer — a multiplier pill reading "1.0x", a payout line reading "0 units pays 0 units", three chips (+5/+10/+25), and a stake input.
3. Click "+10", then "+5". Confirm the stake input now reads `15` and the payout line updates to "15 units pays 15 units" (1.0x multiplier).
4. Type a value directly into the stake input (e.g. clear it and type `20`). Confirm the payout line updates live as you type.
5. Click "Place Bet(s)". Confirm it redirects to `/my-bets` and the new bet appears there with the stake you set.
6. Go back to the props page, select 2 different prop cards (any Over/Under). Confirm the mini-bar shows "2 Picks", the mode label reads "Parlay — 2 picks", the multiplier pill shows the 2-leg multiplier (matches the mini-bar's own multiplier text), and the same chip/stake-input flow works.
7. Place the parlay bet, confirm it succeeds and appears correctly on `/my-bets` as one parlay bet (not two single bets).
8. Remove a leg via its "×" button before placing — confirm the footer's multiplier/payout line recompute immediately for the remaining pick(s).

Report any step that doesn't match before moving to Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/Home.astro src/scripts/betSlip.js
git commit -m "Unify bet slip stake input into one field with quick-add chips"
```

---

### Task 2: Style the new footer

**Files:**
- Modify: `src/styles/global.css:201-213` (rename `.leg-stake, #parlayStake` combined selector)
- Modify: `src/styles/global.css:982-984` (`.bet-slip-leg input` rule — now dead, remove)
- Modify: `src/styles/global.css:1016-1022` (`.bet-slip-summary` rule — replace with new footer rules)

**Interfaces:**
- Consumes: element IDs/classes produced by Task 1 (`#bet-slip-footer`, `#bet-slip-multiplier`, `#bet-slip-payout-line`, `.bet-slip-footer-summary`, `.bet-slip-stake-row`, `.stake-chip`, `#stakeInput`, `#placeBetBtn`).
- Produces: nothing consumed by later tasks (last task).

- [ ] **Step 1: Update the number-input spinner reset**

Find (around line 201-213):

```css
.leg-stake,
#parlayStake {
  -moz-appearance: textfield;
  appearance: textfield;
}

.leg-stake::-webkit-outer-spin-button,
.leg-stake::-webkit-inner-spin-button,
#parlayStake::-webkit-outer-spin-button,
#parlayStake::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

Replace with:

```css
#stakeInput {
  -moz-appearance: textfield;
  appearance: textfield;
}

#stakeInput::-webkit-outer-spin-button,
#stakeInput::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

- [ ] **Step 2: Remove the now-dead per-leg input width rule**

Find (around line 982-984):

```css
.bet-slip-leg input {
  width: 5rem;
}
```

Delete this rule entirely — `.bet-slip-leg` rows no longer contain an `<input>` (Task 1 removed the per-leg stake input).

- [ ] **Step 3: Replace `.bet-slip-summary` with the new footer rules**

Find (around line 1016-1022):

```css
.bet-slip-summary {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  color: var(--primary-text);
  font-weight: 700;
  margin: var(--space-2) 0;
}
```

Replace with:

```css
.bet-slip-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-4) 0;
}

.bet-slip-footer-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.bet-slip-multiplier {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background-color: var(--surface-2);
  color: var(--highlight-color);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 0.9rem;
}

.bet-slip-payout-line {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  color: var(--primary-text);
  font-weight: 700;
  font-size: 0.9rem;
  text-align: right;
}

.bet-slip-stake-row {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
}

.stake-chip {
  flex: 0 0 auto;
  background-color: var(--surface-2);
  color: var(--primary-text);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.85rem;
}

.stake-chip:hover {
  background-color: color-mix(in srgb, var(--highlight-color) 20%, var(--surface-2));
}

#stakeInput {
  flex: 1;
  min-width: 0;
  text-align: center;
}

#placeBetBtn {
  width: 100%;
  margin-top: var(--space-2);
}
```

(`.bet-slip-multiplier` and `.stake-chip` both override the base `button`-element rule at `src/styles/global.css:163-180` — a class selector always beats an element selector regardless of source order, so no `!important` or reordering is needed. `#stakeInput` inherits its base padding/border/background from the existing generic `input[type="number"]` rule at `src/styles/global.css:186-199`; this new rule only adds the flex/text-align layout on top.)

- [ ] **Step 4: Type-check and build**

Run: `npx astro check && npx astro build`
Expected: both complete with 0 errors.

- [ ] **Step 5: Manually verify in the browser**

Repeat the same flow as Task 1 Step 4 (select 1 pick, open the sheet, select 2 picks), this time checking appearance against `docs/superpowers/specs/2026-08-03-bet-slip-footer-design.md`:

1. The multiplier pill and payout line sit on one row, pill on the left, text right-aligned on the right.
2. The three chips and the stake input sit on one row below that; chips stay a fixed/compact width, the input fills the remaining space.
3. Chips and the multiplier pill read in the app's existing pill style (rounded, `--surface-2` background) — not styled like the gold "Place Bet" button.
4. "Place Bet(s)" spans the full width of the sheet.
5. At a narrow mobile width (resize to ~375px or use a phone-sized viewport), confirm the stake row doesn't overflow horizontally — chips should stay readable and the input should shrink to fit rather than pushing off-screen.
6. Compare side-by-side with the reference screenshot's layout (not colors/theme) — badge-left/payout-right, chips-then-input row, full-width submit button underneath.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css
git commit -m "Style the redesigned bet slip footer"
```
