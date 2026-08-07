# Leaderboard Podium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a classic 3-column podium (1st tallest/center, 2nd next-tallest, 3rd shortest) to the top of the Leaderboard's standings list, showcasing the top 3 ranked users, with everyone else continuing below in the existing list format.

**Architecture:** Pure presentation change inside the existing `StandingsBoard` React component. `computeStandings()` already returns a fully-sorted `StandingRow[]`; the component slices the first 3 rows into a new `Podium` sub-component (built from a new `PodiumBlock` sub-component) when there are 3+ rows, and renders the remainder (`slice(3)`) in the existing list unchanged. Below 3 rows, nothing changes from today's behavior.

**Tech Stack:** React (existing `@astrojs/react` island, no new dependencies), TypeScript, inline `style` objects referencing the CSS custom properties already defined in `trust-tokens.css` — matching every other component in this file.

## Global Constraints

- Full design rationale: `docs/superpowers/specs/2026-08-06-leaderboard-podium-design.md`. Read it if anything below is ambiguous.
- **No new files.** `Podium` and `PodiumBlock` are added as new private (unexported) components inside `src/components/react/StandingsBoard.tsx`, following the file's existing pattern (`RankBadge`, `Avatar`, `StreakChip`, `PeriodToggle`, `CalloutCard` are all private helpers already in this file).
- **No new fonts, colors, or CSS files.** Reuse `var(--font-display)`, `var(--font-num)`, `var(--trust-rank-gold)`, `var(--trust-rank-silver)`, `var(--trust-rank-bronze)`, `var(--trust-positive)`, `var(--trust-negative)`, `var(--trust-ink)`, `var(--trust-ink-muted)`, `var(--trust-surface)`, `var(--trust-border)`, `var(--trust-canvas)` — all already defined in `src/styles/trust-tokens.css`.
- **Podium renders only with 3+ standings rows.** 0–2 rows falls back to today's unchanged behavior (plain list, or the existing empty-state message at 0).
- **This codebase has no automated test framework.** Verify with `npx astro check` (0 errors required) plus manual browser verification against the dev server.
- **`StandingsBoardProps` does not change.** No new props — the podium/list split happens entirely inside `StandingsBoard`'s render body from the existing `standings` prop.

---

### Task 1: Add the podium and wire it into `StandingsBoard`

**Files:**
- Modify: `src/components/react/StandingsBoard.tsx`

**Interfaces:**
- Consumes: existing `StandingRow` (`src/components/react/StandingsBoard.tsx:3-12`), existing `Avatar` helper (line 66-104, gets a new optional `size` prop — default unchanged at 32, so every other caller of `Avatar` in this file is unaffected).
- Produces: nothing consumed outside this file — `Podium`/`PodiumBlock` are private, and `StandingsBoardProps` is unchanged, so `leaderboard.astro` and `StandingsBoardIsland.tsx` need no changes.

- [ ] **Step 1: Give `Avatar` an optional `size` prop**

In `src/components/react/StandingsBoard.tsx`, find (lines 66-104):

```tsx
function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid var(--trust-border)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0,
        backgroundColor: "var(--trust-surface-raised)",
        color: "var(--trust-ink-muted)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "0.85rem",
      }}
    >
      {initial}
    </span>
  );
}
```

Replace with:

```tsx
function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid var(--trust-border)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        backgroundColor: "var(--trust-surface-raised)",
        color: "var(--trust-ink-muted)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size >= 56 ? "1.5rem" : "0.85rem",
      }}
    >
      {initial}
    </span>
  );
}
```

Every existing call site (`Avatar src={row.avatarUrl} name={row.displayName}` in the list rows, and `Avatar src={card.avatarUrl} name={card.displayName}` in `CalloutCard`) omits `size`, so they keep rendering at 32px exactly as before — this step is additive only.

- [ ] **Step 2: Add the `Crown` icon and podium constants**

In `src/components/react/StandingsBoard.tsx`, find (lines 37-38):

```tsx
const RANK_COLORS = ["var(--trust-rank-gold)", "var(--trust-rank-silver)", "var(--trust-rank-bronze)"];

```

Replace with:

```tsx
const RANK_COLORS = ["var(--trust-rank-gold)", "var(--trust-rank-silver)", "var(--trust-rank-bronze)"];

// Riser height (px) under each podium block — the actual "1st highest, 2nd
// next, 3rd lowest" effect. Indexed by rank (0 = 1st).
const PODIUM_RISER_HEIGHT = [96, 64, 48];

function Crown() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="var(--trust-rank-gold)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 18L6.5 10L9 14L12 7L15 14L17.5 10L19 18" />
      <path d="M5 18h14" />
    </svg>
  );
}
```

Per the spec, this stays a stroke icon (`stroke`, `strokeWidth={1.6}`, `strokeLinecap`/`strokeLinejoin="round"`) matching every other icon in the app, rather than a filled shape. The zigzag path is 7 absolute points tracing a 3-peak line (left peak, valley, tallest middle peak, valley, right peak) — verified by hand, no relative-coordinate math to get wrong — plus a second `<path>` for the flat base line, the same multi-path-per-icon composition `src/lib/sportIcons.ts` already uses. `PODIUM_RISER_HEIGHT` is indexed by rank (`0`/`1`/`2` = 1st/2nd/3rd), matching the color arrays already in this file (`RANK_COLORS`).

- [ ] **Step 3: Add `PodiumBlock`**

In `src/components/react/StandingsBoard.tsx`, immediately after the `Crown` function from Step 2 (and before `function CalloutCard`), add:

```tsx
function PodiumBlock({ row, rank }: { row: StandingRow; rank: 0 | 1 | 2 }) {
  const isFirst = rank === 0;
  const color = RANK_COLORS[rank];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "1 1 0", minWidth: 0 }}>
      {isFirst && <Crown />}
      <Avatar src={row.avatarUrl} name={row.displayName} size={isFirst ? 72 : 56} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: isFirst ? "1rem" : "0.85rem",
          color: "var(--trust-ink)",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {row.displayName}
      </span>
      <span
        style={{
          fontFamily: "var(--font-num)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 800,
          fontSize: "0.85rem",
          color: row.netUnits >= 0 ? "var(--trust-positive)" : "var(--trust-negative)",
        }}
      >
        {row.netUnits >= 0 ? "+" : ""}
        {row.netUnits.toFixed(1)}
      </span>
      <div
        style={{
          width: "100%",
          height: PODIUM_RISER_HEIGHT[rank],
          borderRadius: "12px 12px 0 0",
          backgroundColor: color,
          display: "flex",
          justifyContent: "center",
          paddingTop: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-num)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 800,
            fontSize: "1.5rem",
            color: "var(--trust-canvas)",
          }}
        >
          {rank + 1}
        </span>
      </div>
    </div>
  );
}

```

Net units keeps the same sign-based color convention (`--trust-positive`/`--trust-negative`) as the list rows below, rather than forcing gold — a podium topper's net units is not guaranteed positive.

- [ ] **Step 4: Add `Podium`**

Immediately after `PodiumBlock` from Step 3, add:

```tsx
function Podium({ top3 }: { top3: [StandingRow, StandingRow, StandingRow] }) {
  const [first, second, third] = top3;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        padding: "24px 16px 0",
        borderRadius: 16,
        backgroundColor: "var(--trust-surface)",
        border: "1px solid var(--trust-border)",
      }}
    >
      <PodiumBlock row={second} rank={1} />
      <PodiumBlock row={first} rank={0} />
      <PodiumBlock row={third} rank={2} />
    </div>
  );
}

```

DOM order is 2nd, 1st, 3rd — the universal podium left-to-right arrangement — so no CSS `order` trick is needed. `alignItems: "flex-end"` on the container bottom-aligns all three columns so the riser bars' fixed heights (96/64/48) are what actually reads as "1st highest, 2nd next, 3rd lowest," regardless of the differing content heights above each riser (1st has a crown + bigger avatar; 2nd/3rd don't).

- [ ] **Step 5: Wire `Podium` into `StandingsBoard`'s render body**

In `src/components/react/StandingsBoard.tsx`, find (around line 244, the start of the exported component):

```tsx
export function StandingsBoard({ period, onPeriodChange, standings, upset, worstBeat }: StandingsBoardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: "var(--font-body)",
        color: "var(--trust-ink)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", margin: 0 }}>
          Standings
        </h2>
        <PeriodToggle period={period} onPeriodChange={onPeriodChange} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--trust-border)",
        }}
      >
        {standings.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--trust-ink-muted)" }}>
            No settled bets yet {period === "week" ? "this week" : "this season"}.
          </div>
        )}
        {standings.map((row, index) => (
          <div
            key={row.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              backgroundColor: index % 2 === 0 ? "var(--trust-surface)" : "var(--trust-surface-raised)",
            }}
          >
            <RankBadge rank={index} />
            <Avatar src={row.avatarUrl} name={row.displayName} />
```

Replace with:

```tsx
export function StandingsBoard({ period, onPeriodChange, standings, upset, worstBeat }: StandingsBoardProps) {
  const top3: [StandingRow, StandingRow, StandingRow] | null =
    standings.length >= 3 ? [standings[0], standings[1], standings[2]] : null;
  const listRows = top3 ? standings.slice(3) : standings;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: "var(--font-body)",
        color: "var(--trust-ink)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", margin: 0 }}>
          Standings
        </h2>
        <PeriodToggle period={period} onPeriodChange={onPeriodChange} />
      </div>

      {top3 && <Podium top3={top3} />}

      {(!top3 || listRows.length > 0) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--trust-border)",
          }}
        >
          {listRows.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--trust-ink-muted)" }}>
              No settled bets yet {period === "week" ? "this week" : "this season"}.
            </div>
          )}
          {listRows.map((row, index) => (
            <div
              key={row.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                backgroundColor: index % 2 === 0 ? "var(--trust-surface)" : "var(--trust-surface-raised)",
              }}
            >
              <RankBadge rank={top3 ? index + 3 : index} />
              <Avatar src={row.avatarUrl} name={row.displayName} />
```

The rest of that row's JSX (the name/record column, `StreakChip`, net-units span, closing tags) is unchanged — only the opening `<div key={row.userId}` through `<Avatar .../>` shown above changes, because `standings.map` became `listRows.map` and `RankBadge`'s `rank` prop now accounts for the podium having already claimed ranks 0-2. Since `listRows` and its wrapping `<div>`/closing tags keep the same shape as the original `standings` block, the remaining closing braces/tags need no edits — only rename every other bare `standings` reference inside this render body (there are none besides the two shown above; `upset`/`worstBeat`/the callout section below are untouched).

- [ ] **Step 6: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 7: Manually verify in the browser**

Run `npm run dev` if not already running, then open `/leaderboard` (log in first if needed).

1. With 3+ users having settled bets this week: confirm a podium renders above the list, in visual order 2nd (left) - 1st (center, larger avatar + crown) - 3rd (right), with 1st's riser clearly the tallest, 2nd next, 3rd shortest, each riser showing "1"/"2"/"3".
2. Confirm the list below the podium starts at rank 4 (badge shows "4", not "1") and the alternating row background still looks correct.
3. Toggle "Season" / "This week" in the period switcher — confirm the podium recomputes (or disappears if that period has under 3 settled bettors) along with the list, matching the corresponding `standings` data for that period.
4. If reachable with current data, find a period where fewer than 3 users have settled bets — confirm no podium renders and the full list (or the "No settled bets yet…" empty state at 0) renders exactly as it did before this change.
5. Confirm a podium member with negative net units (if any exist in the data) renders that number in red, not gold.
6. Confirm the Biggest Upset / Worst Beat callout cards below are unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/components/react/StandingsBoard.tsx
git commit -m "Add top-3 podium to the leaderboard"
```
