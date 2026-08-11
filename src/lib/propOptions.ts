import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getCollection as getPropsCollection } from "./props";

export type OptionType = "sport" | "player" | "stat";

export interface PropOptionDoc {
  _id: ObjectId;
  type: OptionType;
  value: string;
  // Only meaningful for type: "stat" — the sport this stat belongs to.
  // null means "applies to every sport" (used for sport/player docs, and
  // for stat docs created before sport-scoping existed).
  sport: string | null;
  createdAt: Date;
}

let indexEnsured = false;

export async function getCollection(): Promise<Collection<PropOptionDoc>> {
  const client = await clientPromise;
  const collection = client.db().collection<PropOptionDoc>("propOptions");
  if (!indexEnsured) {
    indexEnsured = true;
    const existing = await collection.indexes();
    if (existing.some((idx) => idx.name === "type_1_value_1")) {
      await collection.dropIndex("type_1_value_1");
    }
    await collection.createIndex({ type: 1, value: 1, sport: 1 }, { unique: true });
  }
  return collection;
}

export async function addOption(type: OptionType, value: string, sport: string | null = null): Promise<void> {
  const collection = await getCollection();
  try {
    await collection.insertOne({
      _id: new ObjectId(),
      type,
      value,
      sport: type === "stat" ? sport : null,
      createdAt: new Date(),
    });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return;
    }
    throw err;
  }
}

// Deleting an option only removes it from the explicit propOptions list —
// if a scheduled/live prop still uses this exact (type, value[, sport])
// combination, it keeps showing up via the "used" fallback in listOptions/
// listStatOptionsBySport until that prop is closed or deleted. That's
// intentional: you can't fully hide an option a real prop still depends on.
export async function deleteOption(type: OptionType, value: string, sport: string | null = null): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ type, value, sport: type === "stat" ? sport : null });
  return result.deletedCount === 1;
}

export async function listOptions(type: OptionType): Promise<string[]> {
  const collection = await getCollection();
  const explicit = await collection.find({ type }).toArray();

  const propsCollection = await getPropsCollection();
  const used = await propsCollection.distinct(type, {});

  const set = new Set<string>([...explicit.map((doc) => doc.value), ...used]);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function listOptionSets(): Promise<{
  sport: string[];
  player: string[];
}> {
  const [sport, player] = await Promise.all([listOptions("sport"), listOptions("player")]);
  return { sport, player };
}

// Stats scoped per sport, keyed by sport name — e.g. { NBA: ["Assists", "Points", ...] }.
// A stat doc with sport: null (or missing, for docs created before this field
// existed) applies to every sport, so it's merged into each sport's list.
export async function listStatOptionsBySport(): Promise<Record<string, string[]>> {
  const sports = await listOptions("sport");
  const collection = await getCollection();
  const propsCollection = await getPropsCollection();

  const entries = await Promise.all(
    sports.map(async (sport) => {
      const explicit = await collection.find({ type: "stat", $or: [{ sport }, { sport: null }] }).toArray();
      const used = await propsCollection.distinct("stat", { sport });
      const set = new Set<string>([...explicit.map((doc) => doc.value), ...used]);
      return [sport, Array.from(set).sort((a, b) => a.localeCompare(b))] as const;
    }),
  );

  return Object.fromEntries(entries);
}
