import type { Filter } from "mongodb";
import { getCollection as getBetsCollection, type BetDoc } from "./bets";
import { listAllUsers, type PublicUser } from "./users";
import type { StandingRow, UpsetCard, WorstBeatCard } from "../components/react/StandingsBoard";

export type Period = "week" | "season";

export interface StandingsData {
  standings: StandingRow[];
  upset: UpsetCard | null;
  worstBeat: WorstBeatCard | null;
}

// ISO week: Monday 00:00 local time through the following Monday.
function startOfIsoWeek(now: Date): Date {
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function legDescription(bet: BetDoc): string {
  if (bet.legs.length === 1) {
    const leg = bet.legs[0];
    return `${leg.player} ${leg.pick} ${leg.line} ${leg.stat}`;
  }
  return `${bet.legs.length}-leg parlay`;
}

function decimalOdds(bet: BetDoc): number {
  return bet.stake > 0 ? bet.potentialPayout / bet.stake : 0;
}

export async function computeStandings(period: Period): Promise<StandingsData> {
  const users = await listAllUsers();

  const filter: Filter<BetDoc> = { settledAt: { $ne: null } };
  if (period === "week") {
    filter.settledAt = { $ne: null, $gte: startOfIsoWeek(new Date()) };
  }

  const betsCollection = await getBetsCollection();
  const allBets = await betsCollection.find(filter).sort({ settledAt: 1 }).toArray();

  // Deleted users can leave orphaned bet rows behind (e.g. throwaway test
  // accounts from earlier manual testing) — exclude them so standings never
  // attribute a record, upset, or worst beat to a user who no longer exists.
  const knownUserIds = new Set(users.map((u) => u.id));
  const bets = allBets.filter((bet) => knownUserIds.has(bet.userId.toString()));

  const betsByUser = new Map<string, BetDoc[]>();
  for (const bet of bets) {
    const key = bet.userId.toString();
    const list = betsByUser.get(key);
    if (list) list.push(bet);
    else betsByUser.set(key, [bet]);
  }

  const standings = users
    .map((user) => buildStandingRow(user, betsByUser.get(user.id) ?? []))
    .sort((a, b) => {
      if (b.netUnits !== a.netUnits) return b.netUnits - a.netUnits;
      const aTotal = a.wins + a.losses + a.pushes;
      const bTotal = b.wins + b.losses + b.pushes;
      const aRate = aTotal > 0 ? a.wins / aTotal : 0;
      const bRate = bTotal > 0 ? b.wins / bTotal : 0;
      if (bRate !== aRate) return bRate - aRate;
      return bTotal - aTotal;
    });

  const upset = findBiggestUpset(bets, users);
  const worstBeat = findWorstBeat(bets, users);

  return { standings, upset, worstBeat };
}

function buildStandingRow(user: PublicUser, bets: BetDoc[]): StandingRow {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let netUnits = 0;
  for (const bet of bets) {
    netUnits += (bet.payout ?? 0) - bet.stake;
    if (bet.status === "won") wins++;
    else if (bet.status === "lost") losses++;
    else if (bet.status === "pushed") pushes++;
  }

  return {
    userId: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    avatarUrl: user.avatarUrl,
    wins,
    losses,
    pushes,
    netUnits,
    streak: computeStreak(bets),
  };
}

// Bets are already sorted ascending by settledAt. Walk backward from the
// most recent, skipping pushes (treated as neutral), and count the run of
// consecutive same-outcome bets.
function computeStreak(bets: BetDoc[]): StandingRow["streak"] {
  let type: "win" | "loss" | null = null;
  let length = 0;
  for (let i = bets.length - 1; i >= 0; i--) {
    const status = bets[i].status;
    if (status === "pushed") continue;
    if (status !== "won" && status !== "lost") continue;
    const current: "win" | "loss" = status === "won" ? "win" : "loss";
    if (type === null) {
      type = current;
      length = 1;
    } else if (current === type) {
      length++;
    } else {
      break;
    }
  }
  return type && length >= 2 ? { type, length } : null;
}

function userDisplay(users: PublicUser[], userId: string): { displayName: string; avatarUrl: string | null } {
  const user = users.find((u) => u.id === userId);
  return user
    ? { displayName: `${user.firstName} ${user.lastName}`, avatarUrl: user.avatarUrl }
    : { displayName: "Unknown", avatarUrl: null };
}

// Among the period's won bets, the highest decimal-odds (potentialPayout /
// stake) win — the longest shot that actually hit.
function findBiggestUpset(bets: BetDoc[], users: PublicUser[]): UpsetCard | null {
  const won = bets.filter((b) => b.status === "won");
  if (won.length === 0) return null;
  const best = won.reduce((a, b) => (decimalOdds(b) > decimalOdds(a) ? b : a));
  const { displayName, avatarUrl } = userDisplay(users, best.userId.toString());
  return {
    displayName,
    avatarUrl,
    odds: decimalOdds(best),
    units: best.payout ?? 0,
    description: legDescription(best),
  };
}

// No stored numeric final stat value exists on props (see props.ts —
// PropDoc.result is categorical over/under/push only), so a literal
// "lost by 0.5" margin isn't computable from today's schema. Proxy: the
// period's lost bet with the highest potentialPayout — the one that would
// have hurt the most, if not the closest numerically. See the data-model
// notes at the bottom of StandingsBoard.tsx for the schema-change option.
function findWorstBeat(bets: BetDoc[], users: PublicUser[]): WorstBeatCard | null {
  const lost = bets.filter((b) => b.status === "lost");
  if (lost.length === 0) return null;
  const worst = lost.reduce((a, b) => (b.potentialPayout > a.potentialPayout ? b : a));
  const { displayName, avatarUrl } = userDisplay(users, worst.userId.toString());
  return {
    displayName,
    avatarUrl,
    units: worst.stake,
    description: `${legDescription(worst)} — would've paid ${worst.potentialPayout.toFixed(1)}`,
  };
}
