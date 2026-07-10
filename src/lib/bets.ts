import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getPropById } from "./props";
import { creditUnits, debitUnits } from "./users";

export type BetMode = "single" | "parlay";
export type BetStatus = "pending" | "won" | "lost" | "pushed";
export type LegResult = "pending" | "win" | "loss" | "push";

export interface BetLeg {
  propId: ObjectId;
  sport: string;
  player: string;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
}

export interface BetDoc {
  _id: ObjectId;
  userId: ObjectId;
  mode: BetMode;
  legs: BetLeg[];
  stake: number;
  potentialPayout: number;
  pendingLegCount: number;
  status: BetStatus;
  payout: number | null;
  createdAt: Date;
  settledAt: Date | null;
}

export interface PublicBetLeg {
  propId: string;
  sport: string;
  player: string;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
}

export interface PublicBet {
  id: string;
  mode: BetMode;
  legs: PublicBetLeg[];
  stake: number;
  potentialPayout: number;
  status: BetStatus;
  payout: number | null;
  createdAt: string;
  settledAt: string | null;
}

export interface PickInput {
  propId: string;
  pick: "over" | "under";
  stake?: number;
}

export async function getCollection(): Promise<Collection<BetDoc>> {
  const client = await clientPromise;
  return client.db().collection<BetDoc>("bets");
}

export function toPublicBet(doc: BetDoc): PublicBet {
  return {
    id: doc._id.toString(),
    mode: doc.mode,
    legs: doc.legs.map((leg) => ({
      propId: leg.propId.toString(),
      sport: leg.sport,
      player: leg.player,
      stat: leg.stat,
      line: leg.line,
      pick: leg.pick,
      legResult: leg.legResult,
    })),
    stake: doc.stake,
    potentialPayout: doc.potentialPayout,
    status: doc.status,
    payout: doc.payout,
    createdAt: doc.createdAt.toISOString(),
    settledAt: doc.settledAt ? doc.settledAt.toISOString() : null,
  };
}

export async function placeBets(
  userId: string,
  mode: BetMode,
  picks: PickInput[],
  parlayStake?: number,
): Promise<{ bets: PublicBet[] } | { error: string }> {
  if (picks.length === 0) return { error: "At least one pick is required" };

  const propIds = picks.map((p) => p.propId);
  if (new Set(propIds).size !== propIds.length) {
    return { error: "Duplicate picks are not allowed" };
  }

  if (mode === "parlay") {
    if (picks.length < 2) return { error: "A parlay requires at least 2 picks" };
    if (typeof parlayStake !== "number" || !Number.isFinite(parlayStake) || parlayStake <= 0) {
      return { error: "stake must be a positive number" };
    }
  } else {
    for (const pick of picks) {
      if (typeof pick.stake !== "number" || !Number.isFinite(pick.stake) || pick.stake <= 0) {
        return { error: "Each pick must have a positive stake" };
      }
    }
  }

  const legs: BetLeg[] = [];
  for (const pick of picks) {
    const prop = await getPropById(pick.propId);
    if (!prop) return { error: `Prop ${pick.propId} not found` };
    if (prop.status !== "scheduled") {
      return { error: `${prop.player} — ${prop.stat} is no longer open for betting` };
    }

    legs.push({
      propId: new ObjectId(prop.id),
      sport: prop.sport,
      player: prop.player,
      stat: prop.stat,
      line: prop.line,
      pick: pick.pick,
      legResult: "pending",
    });
  }

  const totalCost =
    mode === "parlay" ? (parlayStake as number) : picks.reduce((sum, p) => sum + (p.stake ?? 0), 0);

  const debited = await debitUnits(userId, totalCost);
  if (!debited) return { error: "Insufficient units" };

  const now = new Date();
  const collection = await getCollection();

  try {
    let docs: BetDoc[];
    if (mode === "parlay") {
      docs = [
        {
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          mode: "parlay",
          legs,
          stake: totalCost,
          potentialPayout: totalCost * 2 ** legs.length,
          pendingLegCount: legs.length,
          status: "pending",
          payout: null,
          createdAt: now,
          settledAt: null,
        },
      ];
    } else {
      docs = legs.map((leg, i) => ({
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        mode: "single",
        legs: [leg],
        stake: picks[i].stake as number,
        potentialPayout: (picks[i].stake as number) * 2,
        pendingLegCount: 1,
        status: "pending",
        payout: null,
        createdAt: now,
        settledAt: null,
      }));
    }

    await collection.insertMany(docs);
    return { bets: docs.map(toPublicBet) };
  } catch (err) {
    await creditUnits(userId, totalCost);
    throw err;
  }
}

export async function listBetsForUser(userId: string): Promise<PublicBet[]> {
  if (!ObjectId.isValid(userId)) return [];
  const collection = await getCollection();
  const docs = await collection
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toPublicBet);
}

export async function countPendingBetsForUser(userId: string): Promise<number> {
  if (!ObjectId.isValid(userId)) return 0;
  const collection = await getCollection();
  return collection.countDocuments({ userId: new ObjectId(userId), status: "pending" });
}

function computeFinalOutcome(
  legs: BetLeg[],
  stake: number,
): { status: BetStatus; payout: number } {
  if (legs.some((leg) => leg.legResult === "loss")) {
    return { status: "lost", payout: 0 };
  }
  if (legs.every((leg) => leg.legResult === "push")) {
    return { status: "pushed", payout: stake };
  }

  const multiplier = legs.reduce((acc, leg) => (leg.legResult === "win" ? acc * 2 : acc), 1);
  return { status: "won", payout: stake * multiplier };
}

export async function settleBetsForProp(
  propId: string,
  result: "over" | "under" | "push",
): Promise<void> {
  if (!ObjectId.isValid(propId)) return;
  const propObjectId = new ObjectId(propId);
  const collection = await getCollection();

  const cursor = collection.find({
    "legs.propId": propObjectId,
    "legs.legResult": "pending",
  });

  for await (const bet of cursor) {
    const leg = bet.legs.find(
      (l) => l.propId.equals(propObjectId) && l.legResult === "pending",
    );
    if (!leg) continue;

    const legResult: LegResult = result === "push" ? "push" : leg.pick === result ? "win" : "loss";

    const updated = await collection.findOneAndUpdate(
      { _id: bet._id, "legs.propId": propObjectId, "legs.legResult": "pending" },
      {
        $set: { "legs.$[leg].legResult": legResult },
        $inc: { pendingLegCount: -1 },
      },
      {
        arrayFilters: [{ "leg.propId": propObjectId, "leg.legResult": "pending" }],
        returnDocument: "after",
      },
    );
    if (!updated) continue;

    if (updated.pendingLegCount <= 0) {
      const { status, payout } = computeFinalOutcome(updated.legs, updated.stake);
      await collection.updateOne(
        { _id: updated._id },
        { $set: { status, payout, settledAt: new Date() } },
      );
      if (payout > 0) await creditUnits(updated.userId.toString(), payout);
    }
  }
}
