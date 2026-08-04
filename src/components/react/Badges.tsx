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
