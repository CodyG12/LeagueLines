# Standings + Badges Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two reusable, presentational React components — `StandingsBoard` and `Badges` — plus their supporting CSS token files and a static badge-definitions config, matching LeagueLines' real design system (not a new one), with data-model documentation as file-bottom comments rather than a separate doc.

**Architecture:** Two new CSS token files (`trust-tokens.css`, `social-tokens.css`) declare purpose-named custom properties that alias the real tokens in `global.css` (with literal fallbacks). Two new React components (`src/components/react/StandingsBoard.tsx`, `Badges.tsx`) are pure props-in/JSX-out — no fetch, no state library, no sorting/aggregation logic — reading the token files' custom properties via inline `style` objects. A new `src/lib/badgeDefinitions.ts` holds badge logic as a static array of `{ id, label, description, target, progress(stats), check(stats) }`, imported by nothing in this plan (a future caller runs it against real stats). Nothing is wired into `src/pages/` — verification uses a temporary preview page + wrapper that are deleted in the final task.

**Tech Stack:** React (existing `@astrojs/react` integration, `client:load` islands), TypeScript, inline styles referencing CSS custom properties — no Tailwind, no CSS-in-JS library, no state management library.

## Global Constraints

- Full design rationale: `docs/superpowers/specs/2026-08-03-standings-badges-design.md`. Read it if anything below is ambiguous.
- **No new fonts.** Use `var(--font-display)` (General Sans, headings/names), `var(--font-body)` (Instrument Sans, labels/body), `var(--font-num)` (Geist, `font-variant-numeric: tabular-nums`, every number) — these already exist in `src/styles/global.css` `:root`. Never Erica One.
- **Streak/badge colors reuse existing semantic tokens** (`--success-color` green / `--danger-color` red / `--highlight-color` gold) — no new hues beyond the two new medal colors named below.
- **Components take zero external data dependencies.** No `fetch`, no `import` of `badgeDefinitions.ts` into `Badges.tsx`, no sorting inside `StandingsBoard.tsx` — every task's component receives fully-resolved props.
- **This codebase has no automated test framework.** Verify with `npx astro check` (0 errors required) plus manual browser verification against the dev server.
- **Do not add anything under `src/pages/` that survives this plan** — the final task's preview page and wrapper are deleted before the plan is done.

---

## Task 1: Token CSS files

**Files:**
- Create: `src/styles/trust-tokens.css`
- Create: `src/styles/social-tokens.css`

**Interfaces:**
- Consumes: `src/styles/global.css` `:root` custom properties (`--primary-bg`, `--secondary-bg`, `--surface-2`, `--primary-text`, `--secondary-text`, `--highlight-color`, `--success-color`, `--danger-color`) — referenced via `var(..., fallback)`, not `@import`ed, so these files work even if `global.css` isn't loaded.
- Produces (for Tasks 3 and 4 to consume as inline-style `var()` references): `--trust-canvas`, `--trust-surface`, `--trust-surface-raised`, `--trust-border`, `--trust-ink`, `--trust-ink-muted`, `--trust-rank-gold`, `--trust-rank-silver`, `--trust-rank-bronze`, `--trust-positive`, `--trust-negative`, `--social-streak-win`, `--social-streak-win-bg`, `--social-streak-loss`, `--social-streak-loss-bg`, `--social-badge-earned`, `--social-badge-earned-bg`, `--social-badge-locked`, `--social-badge-locked-bg`, `--social-progress-track`.

- [ ] **Step 1: Create `src/styles/trust-tokens.css`**

```css
/* Trust tokens — ledger/standings surface + rank-medal colors.
   Values alias the real design system (src/styles/global.css) rather than
   introducing a new palette — see docs/superpowers/specs/2026-08-03-
   standings-badges-design.md for why. Fallback values keep this file
   self-contained if global.css isn't loaded. */
:root {
  --trust-canvas: var(--primary-bg, #050506);
  --trust-surface: var(--secondary-bg, #151417);
  --trust-surface-raised: var(--surface-2, #1c1b20);
  --trust-border: rgba(255, 255, 255, 0.08);
  --trust-ink: var(--primary-text, #f5f5f7);
  --trust-ink-muted: var(--secondary-text, #98979d);
  --trust-rank-gold: var(--highlight-color, #d4a72c);
  --trust-rank-silver: #b0b3be;
  --trust-rank-bronze: #b88a5c;
  --trust-positive: var(--success-color, #30d158);
  --trust-negative: var(--danger-color, #ff453a);
}
```

- [ ] **Step 2: Create `src/styles/social-tokens.css`**

```css
/* Social tokens — streak indicators and badge earned/locked states.
   Streak colors reuse the existing win/loss semantic colors rather than
   a new "flame" hue — DESIGN.md reserves purple for live-game state only.
   See docs/superpowers/specs/2026-08-03-standings-badges-design.md. */
:root {
  --social-streak-win: var(--success-color, #30d158);
  --social-streak-win-bg: rgba(48, 209, 88, 0.14);
  --social-streak-loss: var(--danger-color, #ff453a);
  --social-streak-loss-bg: rgba(255, 69, 58, 0.14);
  --social-badge-earned: var(--highlight-color, #d4a72c);
  --social-badge-earned-bg: rgba(212, 167, 44, 0.12);
  --social-badge-locked: var(--secondary-text, #98979d);
  --social-badge-locked-bg: rgba(255, 255, 255, 0.04);
  --social-progress-track: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 3: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors` (CSS files aren't type-checked, this just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add src/styles/trust-tokens.css src/styles/social-tokens.css
git commit -m "Add trust/social CSS token files for standings + badges"
```

---

## Task 2: Badge definitions config

**Files:**
- Create: `src/lib/badgeDefinitions.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BadgeStats` interface, `BadgeDefinition` interface, `BADGE_DEFINITIONS: BadgeDefinition[]` — for a future caller (not built in this plan) to run against a real user's stats. `Badges.tsx` (Task 4) does NOT import this file.

- [ ] **Step 1: Create `src/lib/badgeDefinitions.ts`**

```ts
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

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-blood",
    label: "First Blood",
    description: "Place your first bet.",
    target: 1,
    progress: (stats) => Math.min(stats.totalBets, 1),
    check: (stats) => stats.totalBets >= 1,
  },
  {
    id: "on-fire",
    label: "On Fire",
    description: "Win 5 bets in a row.",
    target: 5,
    progress: (stats) => Math.min(stats.longestWinStreak, 5),
    check: (stats) => stats.longestWinStreak >= 5,
  },
  {
    id: "giant-killer",
    label: "Giant Killer",
    description: "Win a bet at 5x odds or longer.",
    target: 5,
    progress: (stats) => Math.min(stats.biggestUpsetOdds, 5),
    check: (stats) => stats.biggestUpsetOdds >= 5,
  },
  {
    id: "high-roller",
    label: "High Roller",
    description: "Finish a season with 100+ net units.",
    target: 100,
    progress: (stats) => Math.max(0, Math.min(stats.netUnitsAllTime, 100)),
    check: (stats) => stats.netUnitsAllTime >= 100,
  },
  {
    id: "iron-stomach",
    label: "Iron Stomach",
    description: "Place 25 bets — win or lose, you keep coming back.",
    target: 25,
    progress: (stats) => Math.min(stats.totalBets, 25),
    check: (stats) => stats.totalBets >= 25,
  },
  {
    id: "veteran",
    label: "Veteran",
    description: "Play 3 seasons.",
    target: 3,
    progress: (stats) => Math.min(stats.seasonsPlayed, 3),
    check: (stats) => stats.seasonsPlayed >= 3,
  },
];
```

- [ ] **Step 2: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/badgeDefinitions.ts
git commit -m "Add static badge definitions config"
```

---

## Task 3: `StandingsBoard` component

**Files:**
- Create: `src/components/react/StandingsBoard.tsx`

**Interfaces:**
- Consumes: CSS custom properties from Task 1 (`--trust-*`, `--social-streak-*`), `var(--font-display)`/`var(--font-body)`/`var(--font-num)` from `global.css`.
- Produces: `Period`, `StandingRow`, `UpsetCard`, `WorstBeatCard`, `StandingsBoardProps` types; `StandingsBoard` component — consumed by Task 5's preview wrapper.

- [ ] **Step 1: Create `src/components/react/StandingsBoard.tsx`**

```tsx
export type Period = "week" | "season";

export interface StandingRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  pushes: number;
  netUnits: number;
  streak: { type: "win" | "loss"; length: number } | null;
}

export interface UpsetCard {
  displayName: string;
  avatarUrl: string | null;
  odds: number;
  units: number;
  description: string;
}

export interface WorstBeatCard {
  displayName: string;
  avatarUrl: string | null;
  units: number;
  description: string;
}

export interface StandingsBoardProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  standings: StandingRow[];
  upset: UpsetCard | null;
  worstBeat: WorstBeatCard | null;
}

const RANK_COLORS = ["var(--trust-rank-gold)", "var(--trust-rank-silver)", "var(--trust-rank-bronze)"];

function RankBadge({ rank }: { rank: number }) {
  const color = RANK_COLORS[rank] ?? "var(--trust-ink-muted)";
  const isMedal = rank < 3;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        flexShrink: 0,
        fontFamily: "var(--font-num)",
        fontVariantNumeric: "tabular-nums",
        fontWeight: 800,
        fontSize: "0.85rem",
        color: isMedal ? "var(--trust-canvas)" : color,
        backgroundColor: isMedal ? color : "transparent",
        border: isMedal ? "none" : "1px solid var(--trust-border)",
      }}
    >
      {rank + 1}
    </span>
  );
}

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

function StreakChip({ streak }: { streak: StandingRow["streak"] }) {
  if (!streak || streak.length < 2) return null;
  const isWin = streak.type === "win";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontFamily: "var(--font-num)",
        fontVariantNumeric: "tabular-nums",
        fontWeight: 700,
        fontSize: "0.75rem",
        color: isWin ? "var(--social-streak-win)" : "var(--social-streak-loss)",
        backgroundColor: isWin ? "var(--social-streak-win-bg)" : "var(--social-streak-loss-bg)",
      }}
    >
      {isWin ? "▲" : "▼"}
      {isWin ? "W" : "L"}
      {streak.length}
    </span>
  );
}

function PeriodToggle({ period, onPeriodChange }: { period: Period; onPeriodChange: (p: Period) => void }) {
  const options: { value: Period; label: string }[] = [
    { value: "week", label: "This week" },
    { value: "season", label: "Season" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 999,
        backgroundColor: "var(--trust-surface-raised)",
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === period;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPeriodChange(opt.value)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 16px",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              color: active ? "var(--trust-canvas)" : "var(--trust-ink-muted)",
              backgroundColor: active ? "var(--trust-rank-gold)" : "transparent",
              transition: "background-color 0.15s ease-in-out, color 0.15s ease-in-out",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CalloutCard({
  title,
  emoji,
  card,
  emptyText,
}: {
  title: string;
  emoji: string;
  card: UpsetCard | WorstBeatCard | null;
  emptyText: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 240px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 16,
        borderRadius: 16,
        backgroundColor: "var(--trust-surface)",
        border: "1px solid var(--trust-border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--trust-ink-muted)",
        }}
      >
        {emoji} {title}
      </span>
      {card ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar src={card.avatarUrl} name={card.displayName} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--trust-ink)" }}>
              {card.displayName}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--trust-ink-muted)" }}>
            {card.description}
          </span>
          <span
            style={{
              fontFamily: "var(--font-num)",
              fontVariantNumeric: "tabular-nums",
              fontWeight: 800,
              fontSize: "1.1rem",
              color: "var(--trust-rank-gold)",
            }}
          >
            {"odds" in card ? `${card.odds.toFixed(1)}x · ` : ""}
            {card.units.toFixed(1)} units
          </span>
        </>
      ) : (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--trust-ink-muted)" }}>
          {emptyText}
        </span>
      )}
    </div>
  );
}

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
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.displayName}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-num)",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: "0.8rem",
                  color: "var(--trust-ink-muted)",
                }}
              >
                {row.wins}-{row.losses}-{row.pushes}
              </span>
            </div>
            <StreakChip streak={row.streak} />
            <span
              style={{
                fontFamily: "var(--font-num)",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 800,
                fontSize: "0.95rem",
                minWidth: 64,
                textAlign: "right",
                color: row.netUnits >= 0 ? "var(--trust-positive)" : "var(--trust-negative)",
              }}
            >
              {row.netUnits >= 0 ? "+" : ""}
              {row.netUnits.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <CalloutCard title="Biggest Upset" emoji="🔥" card={upset} emptyText="No upsets yet — chalk city." />
        <CalloutCard title="Worst Beat" emoji="💔" card={worstBeat} emptyText="No bad beats yet — lucky group." />
      </div>
    </div>
  );
}

/*
 * DATA MODEL NOTES — computing props from the existing `bets` collection
 * (see src/lib/bets.ts: BetDoc { userId, mode, legs[], stake,
 * potentialPayout, status, payout, createdAt, settledAt }) and `users`
 * collection (src/lib/users.ts).
 *
 * Scope by period:
 *   - "week": bets where `settledAt` falls within the current ISO week.
 *   - "season": all settled bets, or bets since a SEASON_START constant if
 *     the app later defines explicit seasons — no season concept exists in
 *     the schema today.
 *   Only bets with settledAt set (status !== "pending") count toward
 *   standings — a pending bet hasn't happened yet.
 *
 * Record (W-L-P): for each user, count scoped bets by `status`
 * ("won" -> W, "lost" -> L, "pushed" -> P).
 *
 * Net units: sum(payout - stake) over a user's scoped bets. `payout` is
 * already 0 for losses (see computeFinalOutcome in bets.ts), so this just
 * works without special-casing status.
 *
 * Rank: sort users by net units descending (tie-break: win rate, then
 * total bets as a final tiebreak). `standings[i]`'s rank is `i` — this
 * component does not sort; pass already-ranked rows.
 *
 * Streak: order a user's scoped bets by settledAt ascending, walk backward
 * from the most recent, counting a run of consecutive "won" or "lost".
 * Decide up front whether a "pushed" bet breaks the streak or is skipped
 * over — skipping (treating pushes as neutral) matches most casual-league
 * conventions. Only surface the chip when length >= 2 (StreakChip already
 * enforces this defensively).
 *
 * Biggest upset: among a period's "won" bets, the one with the highest
 * `potentialPayout / stake` ratio (decimal odds). Surface the winner's
 * name/avatar, that ratio as `odds`, and `payout` as `units`.
 *
 * Worst beat: bets/props currently only store a categorical result
 * (over/under/push on PropDoc.result — see src/lib/props.ts), not the
 * actual final stat value, so a literal "lost by 0.5" margin can't be
 * computed from today's schema. Two options:
 *   1. Add `finalValue: number | null` to PropDoc, set at grading time,
 *      then worst beat = the lost leg with the smallest
 *      abs(finalValue - line) in the period.
 *   2. Without a schema change: proxy "worst beat" as the period's "lost"
 *      bet with the highest `potentialPayout` — the one that would have
 *      hurt the most, if not the closest numerically.
 */
```

- [ ] **Step 2: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/StandingsBoard.tsx
git commit -m "Add StandingsBoard component"
```

---

## Task 4: `Badges` component

**Files:**
- Create: `src/components/react/Badges.tsx`

**Interfaces:**
- Consumes: CSS custom properties from Task 1 (`--social-badge-*`, `--social-progress-track`, `--trust-surface`, `--trust-border`, `--trust-ink`, `--trust-ink-muted`), fonts from `global.css`.
- Produces: `BadgeDisplay`, `BadgesProps` types; `Badges` component — consumed by Task 5's preview page. Does NOT import `src/lib/badgeDefinitions.ts`.

- [ ] **Step 1: Create `src/components/react/Badges.tsx`**

```tsx
export interface BadgeDisplay {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  earnedOn: string | null;
  progress: { current: number; target: number } | null;
}

export interface BadgesProps {
  badges: BadgeDisplay[];
}

function formatEarnedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Medallion({ earned }: { earned: boolean }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: `2px solid ${earned ? "var(--social-badge-earned)" : "var(--social-badge-locked)"}`,
        backgroundColor: earned ? "var(--social-badge-earned-bg)" : "var(--social-badge-locked-bg)",
        filter: earned ? "none" : "grayscale(1)",
        opacity: earned ? 1 : 0.6,
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={26}
        height={26}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: earned ? "var(--social-badge-earned)" : "var(--social-badge-locked)" }}
      >
        <circle cx="12" cy="9" r="6" />
        <path d="M9 14.5 7 21l5-3 5 3-2-6.5" />
      </svg>
    </span>
  );
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      <div
        style={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          backgroundColor: "var(--social-progress-track)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: "var(--social-badge-locked)",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-num)",
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.7rem",
          color: "var(--trust-ink-muted)",
        }}
      >
        {current}/{target}
      </span>
    </div>
  );
}

export function Badges({ badges }: BadgesProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 16,
        fontFamily: "var(--font-body)",
      }}
    >
      {badges.map((badge) => (
        <div
          key={badge.id}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 8,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "var(--trust-surface)",
            border: "1px solid var(--trust-border)",
          }}
        >
          <Medallion earned={badge.earned} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.9rem",
              color: "var(--trust-ink)",
            }}
          >
            {badge.label}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--trust-ink-muted)", lineHeight: 1.4 }}>
            {badge.description}
          </span>
          {badge.earned ? (
            <span
              style={{
                fontFamily: "var(--font-num)",
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--social-badge-earned)",
              }}
            >
              Earned on {badge.earnedOn ? formatEarnedDate(badge.earnedOn) : "—"}
            </span>
          ) : badge.progress ? (
            <ProgressBar current={badge.progress.current} target={badge.progress.target} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/*
 * DATA MODEL NOTES
 *
 * New collection `user_badges` — only rows for EARNED badges, per the
 * instruction that badge definitions/logic stay in code
 * (src/lib/badgeDefinitions.ts), not the database:
 *
 *   user_badges {
 *     _id: ObjectId
 *     userId: ObjectId   (indexed)
 *     badgeId: string    (matches BadgeDefinition.id)
 *     earnedAt: Date
 *     statsSnapshot?: object   // optional — the BadgeStats that triggered
 *                              // it, useful for debugging/display, not
 *                              // required for the earned/locked check.
 *   }
 *
 * Locked badges' progress is never stored: it's computed live by running
 * each BadgeDefinition.progress()/check() against a freshly-computed
 * BadgeStats for the viewing user, at the point a page renders this
 * component. The `Badges` component itself does none of this — it only
 * renders whatever `BadgeDisplay[]` it's given.
 *
 * Recommend badge checks run in the same nightly job that grades/settles
 * bets (today, grading happens per-prop from the admin "Close & Grade"
 * action — see settleBetsForProp in src/lib/bets.ts). Once nightly:
 *   1. Recompute BadgeStats per user from their full bet history.
 *   2. For each BadgeDefinition, if check(stats) is true and no
 *      user_badges row exists for that user+badgeId yet, insert one.
 * Do NOT compute badge status live on every page load — that would mean
 * recomputing a user's full lifetime stats (total bets, longest streak,
 * biggest upset odds, etc.) on every request just to render a badges grid.
 */
```

- [ ] **Step 2: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/Badges.tsx
git commit -m "Add Badges component"
```

---

## Task 5: Manual verification, then remove the preview

**Files:**
- Create (temporary, deleted in Step 4): `src/pages/dev-preview-standings-badges.astro`
- Create (temporary, deleted in Step 4): `src/components/react/__PreviewStandingsWrapper.tsx`

**Interfaces:**
- Consumes: `StandingsBoard`, `Badges` (Tasks 3–4), both token CSS files (Task 1).
- Produces: nothing — this task's job is to prove the other four tasks work together, then leave no trace in `src/pages/`.

**Why a wrapper component:** Astro frontmatter can't hold React state, and functions can't be passed as serializable props to a `client:load` island — `StandingsBoard`'s `period`/`onPeriodChange` need to live inside a single React component with its own `useState`.

- [ ] **Step 1: Create `src/components/react/__PreviewStandingsWrapper.tsx`**

```tsx
import { useState } from "react";
import { StandingsBoard, type Period, type StandingRow, type UpsetCard, type WorstBeatCard } from "./StandingsBoard";

const STANDINGS: StandingRow[] = [
  {
    userId: "1",
    displayName: "Cody Gima",
    avatarUrl: null,
    wins: 8,
    losses: 2,
    pushes: 1,
    netUnits: 42.5,
    streak: { type: "win", length: 4 },
  },
  { userId: "2", displayName: "Sam Rivera", avatarUrl: null, wins: 6, losses: 4, pushes: 0, netUnits: 11, streak: null },
  {
    userId: "3",
    displayName: "Alex Johnson",
    avatarUrl: null,
    wins: 5,
    losses: 5,
    pushes: 0,
    netUnits: -8.5,
    streak: { type: "loss", length: 3 },
  },
  {
    userId: "4",
    displayName: "Taylor Brooks",
    avatarUrl: null,
    wins: 2,
    losses: 8,
    pushes: 0,
    netUnits: -30,
    streak: { type: "loss", length: 2 },
  },
];

const UPSET: UpsetCard = {
  displayName: "Cody Gima",
  avatarUrl: null,
  odds: 7.2,
  units: 36,
  description: "3-leg parlay",
};

const WORST_BEAT: WorstBeatCard = {
  displayName: "Taylor Brooks",
  avatarUrl: null,
  units: 20,
  description: "Highest-payout bet of the week that fell through",
};

export function PreviewStandingsWrapper() {
  const [period, setPeriod] = useState<Period>("week");
  return (
    <StandingsBoard
      period={period}
      onPeriodChange={setPeriod}
      standings={STANDINGS}
      upset={UPSET}
      worstBeat={WORST_BEAT}
    />
  );
}
```

- [ ] **Step 2: Create `src/pages/dev-preview-standings-badges.astro`**

```astro
---
// TEMPORARY preview page for manual verification only — see Task 5,
// Step 4, which deletes this file and its wrapper.
import Layout from "../layouts/Layout.astro";
import { Badges, type BadgeDisplay } from "../components/react/Badges";
import { PreviewStandingsWrapper } from "../components/react/__PreviewStandingsWrapper";
import "../styles/trust-tokens.css";
import "../styles/social-tokens.css";

const badges: BadgeDisplay[] = [
  {
    id: "first-blood",
    label: "First Blood",
    description: "Place your first bet.",
    earned: true,
    earnedOn: "2026-07-01T00:00:00.000Z",
    progress: null,
  },
  {
    id: "on-fire",
    label: "On Fire",
    description: "Win 5 bets in a row.",
    earned: false,
    earnedOn: null,
    progress: { current: 4, target: 5 },
  },
  {
    id: "giant-killer",
    label: "Giant Killer",
    description: "Win a bet at 5x odds or longer.",
    earned: true,
    earnedOn: "2026-07-20T00:00:00.000Z",
    progress: null,
  },
  {
    id: "high-roller",
    label: "High Roller",
    description: "Finish a season with 100+ net units.",
    earned: false,
    earnedOn: null,
    progress: { current: 42, target: 100 },
  },
  {
    id: "iron-stomach",
    label: "Iron Stomach",
    description: "Place 25 bets.",
    earned: false,
    earnedOn: null,
    progress: { current: 11, target: 25 },
  },
  {
    id: "veteran",
    label: "Veteran",
    description: "Play 3 seasons.",
    earned: false,
    earnedOn: null,
    progress: { current: 1, target: 3 },
  },
];
---

<Layout>
  <main class="container" style="text-align: left; max-width: 900px;">
    <h1 class="title">Preview: Standings + Badges</h1>
    <PreviewStandingsWrapper client:load />
    <h2 class="title" style="margin-top: 48px;">Badges</h2>
    <Badges client:load badges={badges} />
  </main>
</Layout>
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev` (if not already running), open `http://localhost:4321/dev-preview-standings-badges`.

Confirm:
- Standings list renders 4 rows, rank 1–3 show gold/silver/bronze circular badges, rank 4 shows a plain outlined number.
- Cody Gima's row shows a green "▲W4" streak chip; Alex Johnson and Taylor Brooks show red "▼L3"/"▼L2" chips; Sam Rivera shows no chip (streak is `null`).
- Net units are green when positive, red when negative, right-aligned, tabular numerals.
- Clicking "Season" in the toggle visibly changes its own highlighted state (gold pill moves) — the underlying data doesn't need to change since it's static mock data, just confirm the click handler updates `period` and the toggle re-renders.
- Both callout cards render with name, description, and units/odds.
- Badges grid: "First Blood" and "Giant Killer" render in full gold color with "Earned on [date]"; the other four render grayscale with a progress bar and "current/target" text (e.g. "4/5").
- No console errors (check via browser dev tools or the console-reading tool).
- Resize narrower (e.g. ~400px) and confirm the badges grid reflows to fewer columns and the standings rows don't overflow horizontally.

- [ ] **Step 4: Delete the temporary preview files**

```bash
git rm src/pages/dev-preview-standings-badges.astro src/components/react/__PreviewStandingsWrapper.tsx
```

- [ ] **Step 5: Run `npx astro check` and `npx astro build` one final time**

Run: `npx astro check && npx astro build`
Expected: both complete with `0 errors`, confirming the preview's removal didn't leave any dangling references and the four permanent files (token CSS ×2, `StandingsBoard.tsx`, `Badges.tsx`, `badgeDefinitions.ts`) are all still valid on their own.

- [ ] **Step 6: Commit the removal**

```bash
git commit -m "Remove temporary standings/badges preview"
```
