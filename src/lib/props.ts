import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getCollection as getUsersCollection } from "./users";

export type PropStatus = "scheduled" | "live" | "closed";
export type PropResult = "over" | "under" | "push" | null;

export interface PlayerPropDoc {
  _id: ObjectId;
  sport: string;
  player: string;
  playerUserId: ObjectId | null;
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
  playerUserId: string | null;
  playerAvatarUrl: string | null;
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
  playerUserId?: string | null;
  team: string | null;
  stat: string;
  line: number;
  startTime: Date;
}

export interface UpdatePropInput {
  sport?: string;
  player?: string;
  playerUserId?: string | null;
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
    playerUserId: doc.playerUserId ? doc.playerUserId.toString() : null,
    playerAvatarUrl: null,
    team: doc.team,
    stat: doc.stat,
    line: doc.line,
    startTime: doc.startTime.toISOString(),
    status: doc.status,
    result: doc.result,
    displayTime: formatDisplayTime(doc),
  };
}

async function attachPlayerAvatars(props: PublicPlayerProp[]): Promise<PublicPlayerProp[]> {
  const ids = Array.from(
    new Set(props.map((p) => p.playerUserId).filter((id): id is string => id !== null)),
  );
  if (ids.length === 0) return props;

  const usersCollection = await getUsersCollection();
  const users = await usersCollection
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { avatarUrl: 1 } },
    )
    .toArray();
  const avatarById = new Map(users.map((u) => [u._id.toString(), u.avatarUrl ?? null]));

  return props.map((p) =>
    p.playerUserId ? { ...p, playerAvatarUrl: avatarById.get(p.playerUserId) ?? null } : p,
  );
}

export async function listPublicProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled" })
    .sort({ startTime: 1 })
    .toArray();
  return attachPlayerAvatars(docs.map(toPublicProp));
}

export async function listPublicPropsBySport(sport: string): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled", sport })
    .sort({ startTime: 1 })
    .toArray();
  return attachPlayerAvatars(docs.map(toPublicProp));
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
  return attachPlayerAvatars(docs.map(toPublicProp));
}

export async function getPropById(id: string): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  const [withAvatar] = await attachPlayerAvatars([toPublicProp(doc)]);
  return withAvatar;
}

export async function createProp(input: CreatePropInput): Promise<PublicPlayerProp> {
  const collection = await getCollection();
  const now = new Date();
  const doc: PlayerPropDoc = {
    _id: new ObjectId(),
    sport: input.sport,
    player: input.player,
    playerUserId: input.playerUserId ? new ObjectId(input.playerUserId) : null,
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
  const [withAvatar] = await attachPlayerAvatars([toPublicProp(doc)]);
  return withAvatar;
}

export async function updateProp(
  id: string,
  input: UpdatePropInput,
): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  const { playerUserId, ...rest } = input;
  const setDoc: Partial<PlayerPropDoc> & { updatedAt: Date } = { ...rest, updatedAt: new Date() };
  if (playerUserId !== undefined) {
    setDoc.playerUserId = playerUserId ? new ObjectId(playerUserId) : null;
  }
  const updated = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: setDoc },
    { returnDocument: "after" },
  );
  if (!updated) return null;
  const [withAvatar] = await attachPlayerAvatars([toPublicProp(updated)]);
  return withAvatar;
}

export async function deleteProp(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
