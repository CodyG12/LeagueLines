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
