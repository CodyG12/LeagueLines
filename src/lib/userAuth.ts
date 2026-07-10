import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const USER_COOKIE_NAME = "user_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(payload: string): string {
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET environment variable");
  return createHmac("sha256", secret).update(`user:${payload}`).digest("base64url");
}

export function createUserSessionToken(userId: string): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, sig] = parts;
  if (!userId || !expiresAt || !sig) return null;

  const payload = `${userId}.${expiresAt}`;
  const expectedSig = Buffer.from(sign(payload));
  const actualSig = Buffer.from(sig);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return null;
  }

  if (Date.now() > Number(expiresAt)) return null;
  return userId;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyUserPassword(candidate: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidateHash = scryptSync(candidate, salt, 64);
  const storedHash = Buffer.from(hash, "hex");
  return candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
}
