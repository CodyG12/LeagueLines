import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";

export type PropStatus = "scheduled" | "live" | "closed";
export type PropResult = "over" | "under" | "push" | null;

export interface PlayerPropDoc {
  _id: ObjectId;
  sport: string;
  player: string;
  team: string | null;
  stat: string;
  line: number;
  startTime: Date;
  status: PropStatus;
  result: PropResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPlayerProp {
  id: string;
  sport: string;
  player: string;
  team: string | null;
  stat: string;
  line: number;
  startTime: string;
  status: PropStatus;
  result: PropResult;
  displayTime: string;
}

export interface CreatePropInput {
  sport: string;
  player: string;
  team: string | null;
  stat: string;
  line: number;
  startTime: Date;
}

export interface UpdatePropInput {
  sport?: string;
  player?: string;
  team?: string | null;
  stat?: string;
  line?: number;
  startTime?: Date;
  status?: PropStatus;
  result?: PropResult;
}

export async function getCollection(): Promise<Collection<PlayerPropDoc>> {
  const client = await clientPromise;
  return client.db().collection<PlayerPropDoc>("playerProps");
}

// Lazily flips scheduled props to "live" once their start time has passed,
// so the stored status (not just the derived display text) stays accurate.
async function promoteLiveProps(collection: Collection<PlayerPropDoc>): Promise<void> {
  await collection.updateMany(
    { status: "scheduled", startTime: { $lte: new Date() } },
    { $set: { status: "live", updatedAt: new Date() } },
  );
}

export function formatDisplayTime(doc: Pick<PlayerPropDoc, "status" | "startTime">): string {
  if (doc.status === "closed") return "Final";

  const diffMs = doc.startTime.getTime() - Date.now();
  if (doc.status === "live" || diffMs <= 0) return "Live Now";

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Starts in ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  return `Starts in ${diffHours}h`;
}

export function toPublicProp(doc: PlayerPropDoc): PublicPlayerProp {
  return {
    id: doc._id.toString(),
    sport: doc.sport,
    player: doc.player,
    team: doc.team,
    stat: doc.stat,
    line: doc.line,
    startTime: doc.startTime.toISOString(),
    status: doc.status,
    result: doc.result,
    displayTime: formatDisplayTime(doc),
  };
}

export async function listPublicProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled" })
    .sort({ startTime: 1 })
    .toArray();
  return docs.map(toPublicProp);
}

export async function listPublicPropsBySport(sport: string): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled", sport })
    .sort({ startTime: 1 })
    .toArray();
  return docs.map(toPublicProp);
}

export async function listDistinctSports(): Promise<string[]> {
  const collection = await getCollection();
  const sports = await collection.distinct("sport", { status: "scheduled" });
  return sports.sort((a, b) => a.localeCompare(b));
}

export async function listAllProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublicProp);
}

export async function getPropById(id: string): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toPublicProp(doc) : null;
}

export async function createProp(input: CreatePropInput): Promise<PublicPlayerProp> {
  const collection = await getCollection();
  const now = new Date();
  const doc: PlayerPropDoc = {
    _id: new ObjectId(),
    sport: input.sport,
    player: input.player,
    team: input.team,
    stat: input.stat,
    line: input.line,
    startTime: input.startTime,
    status: "scheduled",
    result: null,
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return toPublicProp(doc);
}

export async function updateProp(
  id: string,
  input: UpdatePropInput,
): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  const updated = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...input, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return updated ? toPublicProp(updated) : null;
}

export async function deleteProp(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
