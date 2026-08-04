import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getCollection as getBetsCollection, type BetDoc } from "./bets";
import { BADGE_DEFINITIONS, type BadgeStats } from "./badgeDefinitions";
import type { BadgeDisplay } from "../components/react/Badges";

export interface UserBadgeDoc {
  _id: ObjectId;
  userId: ObjectId;
  badgeId: string;
  earnedAt: Date;
  statsSnapshot?: BadgeStats;
}

export async function getCollection(): Promise<Collection<UserBadgeDoc>> {
  const client = await clientPromise;
  return client.db().collection<UserBadgeDoc>("user_badges");
}

// No real "season" concept exists in the schema (see the data-model notes
// at the bottom of this file's counterpart, Badges.tsx). Proxy: a season is
// a calendar year — count the distinct years the user has a settled bet in.
function computeBadgeStats(bets: BetDoc[]): BadgeStats {
  const settled = bets
    .filter((b) => b.settledAt !== null)
    .sort((a, b) => a.settledAt!.getTime() - b.settledAt!.getTime());

  let wins = 0;
  let losses = 0;
  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let biggestUpsetOdds = 0;
  let netUnitsAllTime = 0;
  const seasons = new Set<number>();

  for (const bet of settled) {
    netUnitsAllTime += (bet.payout ?? 0) - bet.stake;
    seasons.add(bet.settledAt!.getFullYear());

    if (bet.status === "won") {
      wins++;
      currentWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      const odds = bet.stake > 0 ? bet.potentialPayout / bet.stake : 0;
      biggestUpsetOdds = Math.max(biggestUpsetOdds, odds);
    } else if (bet.status === "lost") {
      losses++;
      currentWinStreak = 0;
    }
    // Pushes don't affect win/loss counts or the streak.
  }

  return {
    totalBets: settled.length,
    wins,
    losses,
    currentWinStreak,
    longestWinStreak,
    biggestUpsetOdds,
    seasonsPlayed: seasons.size,
    netUnitsAllTime,
  };
}

async function computeBadgeStatsForUser(userId: string): Promise<BadgeStats> {
  const betsCollection = await getBetsCollection();
  const bets = await betsCollection.find({ userId: new ObjectId(userId) }).toArray();
  return computeBadgeStats(bets);
}

// Recommended call site: after a bet is settled (see settleBetsForProp in
// bets.ts), not on every page load — see the data-model notes at the
// bottom of Badges.tsx. This app has no cron/nightly-job infrastructure, so
// settlement time is the pragmatic substitute for "nightly."
export async function checkAndAwardBadges(userId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  const stats = await computeBadgeStatsForUser(userId);
  const collection = await getCollection();
  const existing = await collection
    .find({ userId: new ObjectId(userId) }, { projection: { badgeId: 1 } })
    .toArray();
  const earnedIds = new Set(existing.map((doc) => doc.badgeId));
  const toAward = BADGE_DEFINITIONS.filter((def) => !earnedIds.has(def.id) && def.check(stats));
  if (toAward.length === 0) return;

  const now = new Date();
  await collection.insertMany(
    toAward.map((def) => ({
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      badgeId: def.id,
      earnedAt: now,
      statsSnapshot: stats,
    })),
  );
}

export async function getBadgeDisplaysForUser(userId: string): Promise<BadgeDisplay[]> {
  if (!ObjectId.isValid(userId)) return [];
  const [stats, earnedDocs] = await Promise.all([
    computeBadgeStatsForUser(userId),
    getCollection().then((c) => c.find({ userId: new ObjectId(userId) }).toArray()),
  ]);
  const earnedByBadgeId = new Map(earnedDocs.map((doc) => [doc.badgeId, doc]));

  return BADGE_DEFINITIONS.map((def) => {
    const earnedDoc = earnedByBadgeId.get(def.id);
    if (earnedDoc) {
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        earned: true,
        earnedOn: earnedDoc.earnedAt.toISOString(),
        progress: null,
      };
    }
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      earned: false,
      earnedOn: null,
      progress: { current: def.progress(stats), target: def.target },
    };
  });
}
