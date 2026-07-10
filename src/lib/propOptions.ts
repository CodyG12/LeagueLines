import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getCollection as getPropsCollection } from "./props";

export type OptionType = "sport" | "player" | "stat";

export interface PropOptionDoc {
  _id: ObjectId;
  type: OptionType;
  value: string;
  createdAt: Date;
}

let indexEnsured = false;

export async function getCollection(): Promise<Collection<PropOptionDoc>> {
  const client = await clientPromise;
  const collection = client.db().collection<PropOptionDoc>("propOptions");
  if (!indexEnsured) {
    indexEnsured = true;
    await collection.createIndex({ type: 1, value: 1 }, { unique: true });
  }
  return collection;
}

export async function addOption(type: OptionType, value: string): Promise<void> {
  const collection = await getCollection();
  try {
    await collection.insertOne({ _id: new ObjectId(), type, value, createdAt: new Date() });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return;
    }
    throw err;
  }
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
  stat: string[];
}> {
  const [sport, player, stat] = await Promise.all([
    listOptions("sport"),
    listOptions("player"),
    listOptions("stat"),
  ]);
  return { sport, player, stat };
}
