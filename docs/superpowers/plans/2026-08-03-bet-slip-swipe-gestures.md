# Bet Slip Swipe Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two touch gestures to the "Your Picks" bet slip sheet — swipe down on a drag handle to close the sheet, and swipe a pick row left to reveal a tappable Delete panel.

**Architecture:** Two independent gesture systems living where their state already lives: sheet open/close (including the new swipe-to-close) stays in `src/scripts/modal.js`; pick-row swipe-to-reveal-delete goes in `src/scripts/betSlip.js`, which already owns building/rebuilding each row in `renderLegs()`. Both use raw `touchstart`/`touchmove`/`touchend` (not Pointer Events), track the live drag with an inline `transform` while a `.dragging` class disables the element's CSS transition, then on release clear the inline style and toggle a resting-state class — letting the (now re-enabled) CSS transition animate the settle in one continuous motion.

**Tech Stack:** Vanilla JS (touch events), vanilla CSS with custom properties, Astro `astro:page-load` re-init pattern (already used by every script in this codebase for View Transitions compatibility).

## Global Constraints

- Touch-only — no mouse-drag equivalent for either gesture. Desktop keeps using the existing "Close" button and "×" buttons unchanged.
- Swipe-to-close is scoped to a dedicated handle element, not the whole sheet — must never compete with scrolling the pick list or interacting with the footer's stake input/chips/buttons.
- Row swipe reveals a Delete panel (does not delete immediately on swipe alone) — the existing per-row "×" button (`.leg-remove-btn`) must keep working exactly as it does today, unchanged in appearance or behavior.
- Row swipe must direction-lock (using the first ~10px of movement) so a vertical scroll gesture on the pick list is never hijacked as a horizontal swipe.
- Only one row's Delete panel is revealed at a time; starting a swipe on a different row, or tapping outside the revealed row's wrapper, closes it.
- Full spec: `docs/superpowers/specs/2026-08-03-bet-slip-swipe-gestures-design.md`.

---

### Task 1: Swipe down on the handle to close the sheet

**Files:**
- Modify: `src/components/Home.astro:99-100`
- Modify: `src/scripts/modal.js` (whole file, 25 lines)
- Modify: `src/styles/global.css` (insert after line 524, the end of the `.modal-inner` / `@media` block)

**Interfaces:**
- Consumes: nothing from other tasks (independent of Task 2).
- Produces: nothing consumed by Task 2 — these two tasks touch different files except `global.css`, where they add non-overlapping blocks.

- [ ] **Step 1: Add the drag handle to the sheet markup**

In `src/components/Home.astro`, find (lines 99-100):

```astro
    <div class="modal-inner">
      <h2>Your Picks</h2>
```

Replace with:

```astro
    <div class="modal-inner">
      <div class="bet-slip-handle" aria-hidden="true"></div>
      <h2>Your Picks</h2>
```

- [ ] **Step 2: Rewrite `src/scripts/modal.js`**

Replace the entire file contents with:

```js
function init() {
  const openBtn = document.getElementById("openModal");
  const closeBtn = document.getElementById("closeModal");
  const modal = document.getElementById("modal");
  const modalInner = modal ? modal.querySelector(".modal-inner") : null;
  const handle = modalInner ? modalInner.querySelector(".bet-slip-handle") : null;

  if (!openBtn || !closeBtn || !modal) return;

  openBtn.addEventListener("click", () => {
    modal.classList.add("open");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  if (modalInner && handle) {
    let startY = 0;
    let dragDelta = 0;
    let dragging = false;

    handle.addEventListener(
      "touchstart",
      (event) => {
        startY = event.touches[0].clientY;
        dragDelta = 0;
        dragging = true;
        modalInner.classList.add("dragging");
      },
      { passive: true },
    );

    handle.addEventListener(
      "touchmove",
      (event) => {
        if (!dragging) return;
        dragDelta = Math.max(0, event.touches[0].clientY - startY);
        modalInner.style.transform = `translateY(${dragDelta}px)`;
      },
      { passive: true },
    );

    handle.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;

      const closeThreshold = Math.min(120, modalInner.getBoundingClientRect().height * 0.25);
      const shouldClose = dragDelta > closeThreshold;

      modalInner.classList.remove("dragging");
      modalInner.style.transform = "";
      modal.classList.toggle("open", !shouldClose);
    });
  }

  window.showOrHide = function () {
    openBtn.classList.add("visible");
  };
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
```

Note what this does: `touchstart` on the handle begins tracking and adds `.dragging` (which the CSS in Step 3 uses to disable `.modal-inner`'s transition, so it follows the finger 1:1 instead of lagging). `touchmove` clamps the drag to downward-only (`Math.max(0, ...)`) and sets the live inline transform. `touchend` removes `.dragging` (re-enabling the transition) and, in the same synchronous step, clears the inline transform and toggles `.modal`'s `open` class based on whether the drag passed the threshold — because both the transition re-enable and the final-state change happen in one script execution, the browser animates a single continuous motion from wherever the drag left off to the final resting position (fully closed, or snapped back open), rather than jumping.

- [ ] **Step 3: Add the handle and dragging CSS**

In `src/styles/global.css`, find the end of the modal-inner responsive block (around line 514-524):

```css
@media (min-width: 640px) {
  .modal {
    align-items: center;
  }

  .modal-inner {
    max-width: 480px;
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-6);
  }
}
```

Immediately after that closing `}`, insert:

```css

.bet-slip-handle {
  width: 40px;
  height: 4px;
  margin: 0 auto var(--space-4);
  border-radius: var(--radius-pill);
  background-color: rgba(255, 255, 255, 0.25);
  touch-action: none;
}

.modal-inner.dragging {
  transition: none;
}
```

(`touch-action: none` on the handle tells the browser not to apply its own scroll/pan gesture to this element at all, so the touch sequence is fully driven by the JS listeners in Step 2 with no competing native behavior.)

- [ ] **Step 4: Type-check and build**

Run: `npx astro check && npx astro build`
Expected: both complete with 0 errors.

- [ ] **Step 5: Manually verify on a touch-emulated viewport in the browser**

The Claude-in-Chrome tools don't emit real touch events from mouse clicks, so verifying this requires either a real touch device/simulator, or Chrome DevTools' device-toolbar touch emulation (which does dispatch real `touchstart`/`touchmove`/`touchend`). If you can drive Chrome DevTools' device toolbar (or otherwise simulate touch) from this environment, do so; if not, report exactly what you could and couldn't verify — don't claim a check passed without having actually triggered it.

1. Log in, select a pick, open the "Your Picks" sheet. Confirm the small handle bar renders centered above "Your Picks".
2. Touch-drag the handle down partway (less than ~25% of the sheet's height) and release. Confirm the sheet snaps back open smoothly (not instantly/jumping).
3. Touch-drag the handle down further (past ~25% of the sheet's height) and release. Confirm the sheet closes smoothly, same visual motion as tapping "Close".
4. Confirm the existing "Close" button and the mini-bar's open/close behavior are unaffected (this task didn't touch that logic).
5. Confirm dragging the handle does not scroll the underlying page or the pick list.

- [ ] **Step 6: Commit**

```bash
git add src/components/Home.astro src/scripts/modal.js src/styles/global.css
git commit -m "Add swipe-down-to-close on the bet slip sheet's drag handle"
```

---

### Task 2: Swipe a pick row to reveal a Delete panel

**Files:**
- Modify: `src/scripts/betSlip.js`
- Modify: `src/styles/global.css:969-1000` (the `.bet-slip-leg` / `.leg-remove-btn` block)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing consumed by other tasks (last task).

- [ ] **Step 1: Add swipe constants and per-row swipe state to `betSlip.js`**

In `src/scripts/betSlip.js`, find (lines 1-10):

```js
import { animateNumber } from "./animateCounter.js";

// Keep in sync with MAX_LEGS / parlayMultiplier in src/lib/bets.ts.
const MAX_LEGS = 10;
const LEG_ODDS = 21 / 11;

function parlayMultiplier(legCount) {
  const n = Math.min(Math.max(legCount, 0), MAX_LEGS);
  return Math.round(LEG_ODDS ** n * 2) / 2;
}
```

Replace with:

```js
import { animateNumber } from "./animateCounter.js";

// Keep in sync with MAX_LEGS / parlayMultiplier in src/lib/bets.ts.
const MAX_LEGS = 10;
const LEG_ODDS = 21 / 11;

// How far (px) a pick row slides left to reveal its Delete panel, and how
// many px of initial movement decide whether a touch is a horizontal swipe
// or a vertical scroll.
const SWIPE_REVEAL_PX = 96;
const SWIPE_DIRECTION_LOCK_PX = 10;

function parlayMultiplier(legCount) {
  const n = Math.min(Math.max(legCount, 0), MAX_LEGS);
  return Math.round(LEG_ODDS ** n * 2) / 2;
}
```

- [ ] **Step 2: Add `openLegWrap` state and the `attachLegSwipe`/`closeRevealedLegIfOutside` helpers**

In `src/scripts/betSlip.js`, find (around line 33-35):

```js
  const isLoggedIn = document.body.dataset.loggedIn === "true";

  if (!openBtn || !modal || !legsContainer) return;
```

Replace with:

```js
  const isLoggedIn = document.body.dataset.loggedIn === "true";

  if (!openBtn || !modal || !legsContainer) return;

  let openLegWrap = null;

  function closeRevealedLegIfOutside(target) {
    if (!openLegWrap) return;
    if (openLegWrap.contains(target)) return;
    openLegWrap.classList.remove("revealed");
    openLegWrap = null;
  }

  function attachLegSwipe(wrap, row) {
    let startX = 0;
    let startY = 0;
    let dragDeltaX = 0;
    let axis = null;

    wrap.addEventListener(
      "touchstart",
      (event) => {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        dragDeltaX = 0;
        axis = null;
        wrap.classList.add("dragging");
      },
      { passive: true },
    );

    wrap.addEventListener(
      "touchmove",
      (event) => {
        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        if (axis === null) {
          if (Math.abs(deltaX) < SWIPE_DIRECTION_LOCK_PX && Math.abs(deltaY) < SWIPE_DIRECTION_LOCK_PX) {
            return;
          }
          axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
        }

        if (axis !== "x") return;

        event.preventDefault();
        const base = wrap.classList.contains("revealed") ? -SWIPE_REVEAL_PX : 0;
        dragDeltaX = Math.min(0, Math.max(-SWIPE_REVEAL_PX, base + deltaX));
        row.style.transform = `translateX(${dragDeltaX}px)`;
      },
      { passive: false },
    );

    wrap.addEventListener("touchend", () => {
      wrap.classList.remove("dragging");
      row.style.transform = "";

      if (axis !== "x") {
        axis = null;
        return;
      }
      axis = null;

      const shouldReveal = dragDeltaX <= -SWIPE_REVEAL_PX / 2;
      if (shouldReveal) {
        if (openLegWrap && openLegWrap !== wrap) {
          openLegWrap.classList.remove("revealed");
        }
        wrap.classList.add("revealed");
        openLegWrap = wrap;
      } else {
        wrap.classList.remove("revealed");
        if (openLegWrap === wrap) openLegWrap = null;
      }
    });
  }
```

Note the direction-lock: `touchmove` doesn't decide "x" or "y" until movement exceeds `SWIPE_DIRECTION_LOCK_PX` on at least one axis, then commits to whichever axis had the larger delta at that moment. Once locked to `"y"`, the handler returns early every subsequent move (never calls `preventDefault`), so the browser's native vertical scroll of `#bet-slip-legs` proceeds untouched. Once locked to `"x"`, it calls `preventDefault()` to stop the page from also trying to scroll while the row is being dragged horizontally.

Note the transition mechanics on `touchend` are the same pattern as Task 1's handle: remove `.dragging` (re-enables the row's CSS transition) and clear the inline `transform` in the same synchronous block as the `.revealed` class toggle, so the browser animates one continuous motion from the dragged position to the final resting position (open or closed) instead of jumping.

- [ ] **Step 3: Rewrite `renderLegs()` to build the wrap + Delete panel structure**

In `src/scripts/betSlip.js`, find the current `renderLegs()` (it starts after the helpers from Step 2 and reads, before this task's changes):

```js
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
```

Replace it with:

```js
  function renderLegs() {
    const picks = getSelectedPicks();
    const mode = currentMode();

    legsContainer.innerHTML = "";
    openLegWrap = null;

    picks.forEach(({ prop, pick }) => {
      const wrap = document.createElement("div");
      wrap.className = "bet-slip-leg-wrap";

      const deleteAction = document.createElement("button");
      deleteAction.type = "button";
      deleteAction.className = "bet-slip-leg-delete-action";
      deleteAction.textContent = "Delete";
      deleteAction.addEventListener("click", () => {
        deselectPick(prop.id, pick);
        syncOpenButtonVisibility();
        renderLegs();
      });
      wrap.appendChild(deleteAction);

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

      wrap.appendChild(row);
      attachLegSwipe(wrap, row);
      legsContainer.appendChild(wrap);
    });

    if (betModeLabel) {
      betModeLabel.textContent =
        mode === "parlay" ? `Parlay — ${picks.length} picks` : "Individual bet";
    }

    betSlipFooter.hidden = picks.length === 0;
    updateSummary();
  }
```

(`openLegWrap = null` at the top matters: every call rebuilds `legsContainer` from scratch, destroying any previously-revealed row's DOM node, so the reference must be cleared or it would point at a detached element.)

- [ ] **Step 4: Close a revealed row when tapping elsewhere**

In `src/scripts/betSlip.js`, find the delegated click handler near the end of `init()`:

```js
  delegatedClickHandler = (event) => {
    if (event.target.closest(".over-btn, .under-btn")) {
      renderLegs();
    }
  };
```

Replace with:

```js
  delegatedClickHandler = (event) => {
    closeRevealedLegIfOutside(event.target);
    if (event.target.closest(".over-btn, .under-btn")) {
      renderLegs();
    }
  };
```

This reuses the same delegated `document`-level listener the file already has (rather than adding a second one), since it's already correctly re-attached on every `astro:page-load` re-init per the comment above it.

- [ ] **Step 5: Update the row CSS and add the wrap/delete-panel CSS**

In `src/styles/global.css`, find (lines 969-1000):

```css
/* Bet slip */
.bet-slip-leg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--primary-text);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-2);
  text-align: left;
}

.leg-remove-btn {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger-color);
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.9rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.leg-remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}
```

Replace with:

```css
/* Bet slip */
.bet-slip-leg-wrap {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  touch-action: pan-y;
}

.bet-slip-leg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--primary-text);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  text-align: left;
  position: relative;
  z-index: 1;
  transition: transform 0.2s ease-out;
}

.bet-slip-leg-wrap.dragging .bet-slip-leg {
  transition: none;
}

.bet-slip-leg-wrap.revealed .bet-slip-leg {
  transform: translateX(-96px);
}

.bet-slip-leg-delete-action {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--space-4) 0 0;
  background-color: var(--danger-color);
  color: white;
  font-weight: 700;
  border-radius: var(--radius-md);
}

.bet-slip-leg-delete-action:hover,
.bet-slip-leg-delete-action:active {
  background-color: var(--danger-color);
}

.leg-remove-btn {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger-color);
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.9rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.leg-remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}
```

Note `-96px` matches `SWIPE_REVEAL_PX` from Step 1 — if that constant is ever changed, this value must change with it (there's no shared source between CSS and JS for this number, same as the rest of this codebase's existing CSS/JS split).

Note the `.bet-slip-leg-delete-action:hover`/`:active` rule: the base `button:hover` rule elsewhere in this file (`background-color: #ffd54a`) has higher specificity than a bare custom class alone (an element+pseudo-class selector beats a single class selector), so without this explicit override the Delete panel would flash gold on hover/tap-highlight. This mirrors the same fix already applied to `.stake-chip:hover` in the bet slip footer work.

- [ ] **Step 6: Type-check and build**

Run: `npx astro check && npx astro build`
Expected: both complete with 0 errors.

- [ ] **Step 7: Manually verify on a touch-emulated viewport in the browser**

Same caveat as Task 1 Step 5 — this needs real touch events (Chrome DevTools device-toolbar emulation, a real device, or equivalent). Report exactly what you could and couldn't verify.

1. Select 2+ picks, open the sheet. Touch-swipe one pick row left partway (less than half of the reveal distance) and release. Confirm the row snaps back closed.
2. Touch-swipe a row left further (past half the reveal distance) and release. Confirm a red "Delete" panel is revealed on the right, and the row's label + "×" button have slid left together as one unit.
3. Tap the revealed "Delete" panel. Confirm that pick is removed — same result as tapping "×" would have produced (row disappears, mini-bar count decrements, footer recomputes).
4. Swipe a different row open, without touching the first. Confirm only the newly-swiped row stays revealed (any previously-revealed row closes automatically).
5. Swipe a row open, then tap elsewhere on the sheet (e.g. the "Your Picks" heading, or another row's label without swiping it). Confirm the revealed row closes.
6. Confirm the existing "×" button still works via a normal tap/click on a row that hasn't been swiped.
7. With 3+ picks selected (enough that the pick list scrolls within the sheet), perform a vertical scroll gesture starting on top of a row. Confirm the list scrolls normally and no row's Delete panel gets revealed by the vertical gesture.
8. Confirm placing a bet, and the parlay/single-mode summary in the footer, still work correctly after these DOM structure changes (this exercises `getSelectedPicks()`/`currentMode()`/`updateSummary()`, none of which this task changed, but the row DOM structure did change).

- [ ] **Step 8: Commit**

```bash
git add src/scripts/betSlip.js src/styles/global.css
git commit -m "Add swipe-to-reveal-delete on bet slip pick rows"
```
