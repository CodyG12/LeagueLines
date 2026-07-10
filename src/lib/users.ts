import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { hashPassword, verifyUserPassword } from "./userAuth";

export const STARTING_UNITS = 1000;

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  units: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  units: number;
}

let indexEnsured = false;

export async function getCollection(): Promise<Collection<UserDoc>> {
  const client = await clientPromise;
  const collection = client.db().collection<UserDoc>("users");
  if (!indexEnsured) {
    indexEnsured = true;
    await collection.createIndex({ email: 1 }, { unique: true });
  }
  return collection;
}

export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    units: doc.units,
  };
}

export async function createUser(
  email: string,
  password: string,
): Promise<PublicUser | "duplicate"> {
  const collection = await getCollection();
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    units: STARTING_UNITS,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await collection.insertOne(doc);
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return "duplicate";
    }
    throw err;
  }

  return toPublicUser(doc);
}

export async function verifyUserCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ email: email.toLowerCase() });
  if (!doc) return null;
  if (!verifyUserPassword(password, doc.passwordHash)) return null;
  return toPublicUser(doc);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toPublicUser(doc) : null;
}

export async function debitUnits(userId: string, amount: number): Promise<PublicUser | null> {
  if (!ObjectId.isValid(userId)) return null;
  const collection = await getCollection();
  const updated = await collection.findOneAndUpdate(
    { _id: new ObjectId(userId), units: { $gte: amount } },
    { $inc: { units: -amount }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return updated ? toPublicUser(updated) : null;
}

export async function creditUnits(userId: string, amount: number): Promise<void> {
  if (!ObjectId.isValid(userId) || amount <= 0) return;
  const collection = await getCollection();
  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { units: amount }, $set: { updatedAt: new Date() } },
  );
}
