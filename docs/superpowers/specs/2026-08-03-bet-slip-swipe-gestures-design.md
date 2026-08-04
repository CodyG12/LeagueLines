# Bet Slip Swipe Gestures — Design

## Problem

The "Your Picks" bet slip sheet (`.modal-inner` in `src/components/Home.astro`,
behavior in `src/scripts/modal.js` and `src/scripts/betSlip.js`) currently only
closes via a "Close" button and only removes a pick via a small "×" button per
row. The user wants two touch gestures added: swipe down on the sheet to close
it, and swipe on a pick row to reveal a Delete button. Confirmed with the
user: touch-only (no mouse-drag equivalent — desktop keeps using the existing
buttons, which must keep working unchanged since they're the only removal/close
path there), and swiping a row reveals a tappable Delete panel (iOS Mail
pattern) rather than deleting immediately.

## Decisions

- **Swipe-to-close is scoped to a dedicated handle, not the whole sheet.** A
  new `.bet-slip-handle` element (a small pill bar) is added as the first
  child of `.modal-inner`, above the "Your Picks" heading — the standard
  bottom-sheet visual/interaction convention, and the same treatment shown in
  the reference screenshot from the earlier footer redesign. Scoping the drag
  to this one small element means it can never conflict with scrolling
  `#bet-slip-legs` or interacting with the stake input/chips/buttons below it
  — those areas have no drag listener at all.
- **Row swipe reveals a Delete panel; the existing "×" button is unchanged.**
  Swiping a `.bet-slip-leg` row left slides its existing content (label + "×"
  button, as one unit) to reveal a solid `--danger-color` "Delete" panel
  underneath. Tapping that panel removes the pick via the same path the "×"
  button already uses (`deselectPick` → `syncOpenButtonVisibility` →
  `renderLegs()`). The "×" button is not removed, hidden, or restyled — it's
  the only removal method on desktop, since the swipe gesture is touch-only.
- **Direction-locking on row swipes.** A row's touch listener does not commit
  to horizontal (swipe) or vertical (scroll) handling until the first ~10px
  of movement clearly favors one axis. Once locked horizontal, it calls
  `preventDefault()` on further `touchmove` so the page doesn't also scroll;
  once locked vertical, it does nothing and lets the browser scroll
  `#bet-slip-legs` normally. This is the mechanism that keeps swipe-to-delete
  from breaking scroll on a sheet with many picks.
- **Only one row stays revealed at a time.** Starting a swipe on a different
  row, or tapping anywhere outside the currently-revealed row's wrapper,
  closes it. This reuses the existing delegated-listener pattern already in
  `betSlip.js` (the `document`-level click listener that re-renders legs on
  pick selection) rather than introducing a new event-handling style.
- **Both gestures use live 1:1 tracking with a snap threshold**, not a fixed
  animation: the element follows the finger exactly during the drag (CSS
  transition disabled via a `.dragging` class while a drag is active), and on
  release either completes the action (close / reveal) or snaps back,
  re-enabling the transition so that settle is animated. Sheet-close
  threshold: releasing past roughly a quarter of the sheet's height.
  Row-reveal threshold: releasing past roughly half the reveal distance.
  Both are "roughly" because the plan will pick exact pixel/percentage
  constants — the spec fixes the *behavior*, not the tuning.
- **Touch-only, Pointer Events not used here.** Unlike `profileCardTilt.js`
  (which uses Pointer Events for a hover-tilt effect meant for mouse users),
  these two gestures use `touchstart`/`touchmove`/`touchend` directly, per
  the confirmed decision that this is a touch-specific feature with no
  desktop equivalent.
- **File ownership follows existing responsibility split.** Sheet
  open/close (including the new swipe-to-close) stays in `src/scripts/modal.js`,
  which already owns `.modal`'s open/close state — swipe-to-close is a new
  *trigger* for the exact close it already performs, not a new state
  machine. Row swipe-to-reveal-delete goes in `src/scripts/betSlip.js`,
  which already owns building/rebuilding each pick row in `renderLegs()`.

## Markup changes

```astro
<!-- src/components/Home.astro — new handle above "Your Picks" -->
<div class="modal-inner">
  <div class="bet-slip-handle" aria-hidden="true"></div>
  <h2>Your Picks</h2>
  <div id="bet-slip-legs"></div>
  ...
```

```js
// src/scripts/betSlip.js renderLegs() — each row gets a wrapper + delete panel
// (replaces today's bare `.bet-slip-leg` row creation)
const wrap = document.createElement("div");
wrap.className = "bet-slip-leg-wrap";

const deleteAction = document.createElement("button");
deleteAction.type = "button";
deleteAction.className = "bet-slip-leg-delete-action";
deleteAction.textContent = "Delete";
// click handler: same removal path as the "×" button

const row = document.createElement("div"); // today's .bet-slip-leg, unchanged internals
// ...label + .leg-remove-btn exactly as today...

wrap.appendChild(deleteAction);
wrap.appendChild(row);
legsContainer.appendChild(wrap);
```

## Explicitly out of scope (YAGNI)

- Mouse-drag equivalents for either gesture — touch-only, per the confirmed
  decision.
- Swipe-to-delete auto-triggering past a large enough drag without a tap
  (i.e., no "swipe far enough and it just deletes" shortcut) — the user
  chose the reveal-then-tap pattern specifically; a fast-swipe shortcut was
  not requested and isn't added.
- Any change to the "×" button's appearance, position, or click behavior.
- Any change to the "Close" button's appearance or click behavior — swipe is
  an additional way to trigger the same close, not a replacement.
- Haptics / vibration feedback — not available/meaningful in a mobile web
  view without native app wrapping, not requested.
- Swiping in the vertical direction on a row, or horizontal direction on the
  handle — each gesture only responds on its own axis; the plan does not
  need to design a combined/diagonal gesture.

## Files touched

- **Modify** `src/components/Home.astro` — add `.bet-slip-handle` div.
- **Modify** `src/scripts/modal.js` — add touch listeners on the handle;
  reuse the existing `modal.classList.remove("open")` close path.
- **Modify** `src/scripts/betSlip.js` — restructure `renderLegs()`'s row
  creation to add the wrapper + delete-action panel; add per-row touch
  listeners; add the single-open-row tracking and the delegated
  tap-elsewhere-closes listener.
- **Modify** `src/styles/global.css` — `.bet-slip-handle`,
  `.bet-slip-leg-wrap`, `.bet-slip-leg-delete-action`, a `.dragging`
  modifier (transition-disabling) reused by both gestures, and a
  `.revealed` modifier for the row's open resting position. `.bet-slip-leg`
  moves its `margin-bottom` to `.bet-slip-leg-wrap` (the row itself now
  sits inside the wrapper, not directly in the flow).
