# Profile Pictures on Player Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload an optional profile picture at signup, let admins link a player prop's "player" to a registered user, and show that user's photo centered on the player prop card (public and admin views).

**Architecture:** Vercel Blob stores uploaded images; MongoDB stores the resulting URL on the user doc and an optional `playerUserId` reference on the prop doc. Card-rendering code batch-resolves `playerUserId → avatarUrl` at read time so there's no N+1 query. The admin form's existing player `<select>` gains a "Registered Users" optgroup (values prefixed `user:<id>`) instead of a second control.

**Tech Stack:** Astro (server output, `@astrojs/node` adapter), MongoDB driver, `@vercel/blob` (new dependency), vanilla client-side JS (`src/scripts/adminProps.js`).

## Global Constraints

- This codebase has **no automated test framework** (no test runner in `package.json`, no `*.test.*` files anywhere). Do not introduce one for this feature — verify with `npx astro check` (type safety) plus manual `curl` / browser steps, matching how every existing feature in this repo is verified.
- Server-only env vars are read via `import.meta.env.X`, never `process.env.X` — `@vercel/blob`'s own README notes Vite does not populate `process.env` from `.env`, so the token must be read via `import.meta.env` and passed explicitly to `put()`.
- Missing required env vars throw a clear `Error("Missing X environment variable")` at first use — matches the existing pattern in `src/lib/adminAuth.ts` and `src/lib/userAuth.ts`. Do not add silent fallbacks.
- MongoDB is schemaless — no migration script is needed for the new `playerUserId`/`avatarUrl` fields. Existing docs simply lack them (`undefined`, treated the same as `null`).
- Follow existing code style: no comments except where a non-obvious constraint needs explaining (this repo's existing files have almost none).

---

## Task 1: `@vercel/blob` dependency and `avatarStorage.ts`

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/env.d.ts` (declare the new env var)
- Create: `src/lib/avatarStorage.ts`

**Interfaces:**
- Produces: `uploadAvatar(file: File, ownerKey: string): Promise<string>` — returns the public URL of the uploaded blob. `ownerKey` is just a string used to namespace the storage path (at signup time there's no user id yet, so Task 4 passes the username instead); it doesn't need to be a real database id. Throws `InvalidAvatarError` (exported class, `code: "invalid-type" | "too-large"`) for a bad file, or a plain `Error` if `BLOB_READ_WRITE_TOKEN` is missing.

- [ ] **Step 1: Install the dependency**

Run: `npm install @vercel/blob`
Expected: `package.json` and `package-lock.json` both change; `@vercel/blob` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write `src/lib/avatarStorage.ts`**

```ts
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export class InvalidAvatarError extends Error {
  code: "invalid-type" | "too-large";

  constructor(code: "invalid-type" | "too-large", message: string) {
    super(message);
    this.code = code;
  }
}

export async function uploadAvatar(file: File, ownerKey: string): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new InvalidAvatarError("invalid-type", `Unsupported avatar type: ${file.type}`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new InvalidAvatarError("too-large", `Avatar exceeds ${MAX_SIZE_BYTES} bytes`);
  }

  const token = import.meta.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Missing BLOB_READ_WRITE_TOKEN environment variable");

  const extension = file.type.split("/")[1];
  const pathname = `avatars/${ownerKey}-${Date.now()}.${extension}`;

  const blob = await put(pathname, file, {
    access: "public",
    token,
    contentType: file.type,
  });

  return blob.url;
}
```

- [ ] **Step 3: Declare the new env var's type**

`src/env.d.ts` declares `ImportMetaEnv` as a closed interface (no index signature), so accessing an undeclared key is a type error. Change:

```ts
interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly ADMIN_PASSWORD: string;
  readonly SESSION_SECRET: string;
}
```

to:

```ts
interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly ADMIN_PASSWORD: string;
  readonly SESSION_SECRET: string;
  readonly BLOB_READ_WRITE_TOKEN: string;
}
```

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: `0 errors` in the result summary (existing hints/warnings from other files are fine and unrelated).

- [ ] **Step 5: Note the required env var (manual, one-time)**

`avatarStorage.ts` requires `BLOB_READ_WRITE_TOKEN` in `.env` for local dev. This repo's `.env` doesn't have a `.env.example` file (checked: none exists), so there's no template to update. To get a token: create/select a Blob store in the Vercel dashboard for this project, copy its read-write token, and add `BLOB_READ_WRITE_TOKEN=<token>` to `.env` locally. This step has no automated verification — Task 4's curl tests will fail with "Missing BLOB_READ_WRITE_TOKEN environment variable" until this is done.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/env.d.ts src/lib/avatarStorage.ts
git commit -m "Add avatarStorage module wrapping Vercel Blob uploads"
```

---

## Task 2: Extend `users.ts` — `avatarUrl` and `listAllUsers`

**Files:**
- Modify: `src/lib/users.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UserDoc.avatarUrl: string | null`, `PublicUser.avatarUrl: string | null`, `createUser(firstName, lastName, username, password, avatarUrl?: string | null): Promise<PublicUser | "duplicate">` (new optional 5th param, defaults to `null` — existing 4-arg callers keep compiling), `listAllUsers(): Promise<PublicUser[]>`.

- [ ] **Step 1: Add `avatarUrl` to both interfaces**

In `src/lib/users.ts`, change:

```ts
export interface UserDoc {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  units: number;
  createdAt: Date;
  updatedAt: Date;
}
```

to:

```ts
export interface UserDoc {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  avatarUrl: string | null;
  units: number;
  createdAt: Date;
  updatedAt: Date;
}
```

and change:

```ts
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  units: number;
}
```

to:

```ts
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
  units: number;
}
```

- [ ] **Step 2: Update `toPublicUser`**

Change:

```ts
export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    username: doc.username,
    units: doc.units,
  };
}
```

to:

```ts
export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    username: doc.username,
    avatarUrl: doc.avatarUrl ?? null,
    units: doc.units,
  };
}
```

- [ ] **Step 3: Update `createUser` to accept an optional `avatarUrl`**

Change the signature and body:

```ts
export async function createUser(
  firstName: string,
  lastName: string,
  username: string,
  password: string,
): Promise<PublicUser | "duplicate"> {
  const collection = await getCollection();
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    firstName,
    lastName,
    username: username.toLowerCase(),
    passwordHash: hashPassword(password),
    units: STARTING_UNITS,
    createdAt: now,
    updatedAt: now,
  };
```

to:

```ts
export async function createUser(
  firstName: string,
  lastName: string,
  username: string,
  password: string,
  avatarUrl: string | null = null,
): Promise<PublicUser | "duplicate"> {
  const collection = await getCollection();
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    firstName,
    lastName,
    username: username.toLowerCase(),
    passwordHash: hashPassword(password),
    avatarUrl,
    units: STARTING_UNITS,
    createdAt: now,
    updatedAt: now,
  };
```

(The rest of the function body — the `try`/`catch`/`insertOne` — is unchanged.)

- [ ] **Step 4: Add `listAllUsers`**

Add this new function after `getUserById` (after the closing brace of the function currently at the end of that block):

```ts
export async function listAllUsers(): Promise<PublicUser[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).sort({ firstName: 1, lastName: 1 }).toArray();
  return docs.map(toPublicUser);
}
```

- [ ] **Step 5: Type-check**

Run: `npx astro check`
Expected: `0 errors`. (This will flag any other file still calling `createUser` in a way that's incompatible — there should be none yet, since `signup.ts` isn't touched until Task 4 and already only passes 4 args, which remains valid because `avatarUrl` defaults to `null`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/users.ts
git commit -m "Add avatarUrl to users and a listAllUsers helper"
```

---

## Task 3: Placeholder avatar asset

**Files:**
- Create: `public/avatar-placeholder.svg`

**Interfaces:**
- Produces: a static file served at `/avatar-placeholder.svg`, used as the `<img>` fallback `src` in Task 9.

- [ ] **Step 1: Write the SVG**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
  <circle cx="32" cy="32" r="32" fill="#151417" />
  <circle cx="32" cy="25" r="12" fill="#98979d" />
  <path d="M8 58c0-13.255 10.745-24 24-24s24 10.745 24 24" fill="#98979d" />
</svg>
```

(Colors are `--secondary-bg` and `--secondary-text` from `src/styles/global.css`, hardcoded since a static SVG file can't reference CSS custom properties.)

- [ ] **Step 2: Verify it's served**

Run: `npm run dev` (if not already running), then in another terminal:
`curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:4321/avatar-placeholder.svg`
Expected: `200 image/svg+xml` (port may be `4322` etc. if `4321` is taken — check the dev server's own startup log for the actual port).

- [ ] **Step 3: Commit**

```bash
git add public/avatar-placeholder.svg
git commit -m "Add default placeholder avatar asset"
```

---

## Task 4: Signup flow — optional photo upload

**Files:**
- Modify: `src/pages/signup.astro`
- Modify: `src/pages/api/auth/signup.ts`

**Interfaces:**
- Consumes: `uploadAvatar` and `InvalidAvatarError` from `src/lib/avatarStorage.ts` (Task 1); `createUser(..., avatarUrl?)` from `src/lib/users.ts` (Task 2).
- Produces: nothing new consumed elsewhere — this is a leaf feature (the account now has a photo, verified visually once Task 9 renders it).

- [ ] **Step 1: Add the file input and multipart encoding to `signup.astro`**

Change the error messages block to add two new codes, and change the `<form>` tag and add the file input. Full replacement of the existing `<form>...</form>` block:

```astro
    {error === "duplicate" && <p class="form-error">An account with that username already exists.</p>}
    {error === "missing-fields" && <p class="form-error">Please fill out all fields.</p>}
    {error === "invalid-username" && <p class="form-error">Username must be 3–20 characters, using only letters, numbers, and underscores.</p>}
    {error === "short-password" && <p class="form-error">Password must be at least 8 characters.</p>}
    {error === "invalid-avatar-type" && <p class="form-error">Profile picture must be a PNG, JPEG, WEBP, or GIF image.</p>}
    {error === "avatar-too-large" && <p class="form-error">Profile picture must be smaller than 5MB.</p>}
    <form method="POST" action="/api/auth/signup" class="admin-form" enctype="multipart/form-data" data-astro-reload>
      <label for="firstName">First Name</label>
      <input type="text" id="firstName" name="firstName" required autofocus />
      <label for="lastName">Last Name</label>
      <input type="text" id="lastName" name="lastName" required />
      <label for="username">Username</label>
      <input
        type="text"
        id="username"
        name="username"
        minlength="3"
        maxlength="20"
        pattern="[a-zA-Z0-9_]{3,20}"
        title="3-20 characters: letters, numbers, and underscores only"
        required
      />
      <label for="password">Password</label>
      <input type="password" id="password" name="password" minlength="8" required />
      <label for="avatar">Profile Picture (optional)</label>
      <input type="file" id="avatar" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" />
      <button type="submit">Sign Up</button>
    </form>
```

- [ ] **Step 2: Handle the upload in `api/auth/signup.ts`**

Replace the full file contents with:

```ts
import type { APIRoute } from "astro";
import { createUser } from "../../../lib/users";
import { USER_COOKIE_NAME, createUserSessionToken } from "../../../lib/userAuth";
import { uploadAvatar, InvalidAvatarError } from "../../../lib/avatarStorage";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const firstName = form.get("firstName");
  const lastName = form.get("lastName");
  const username = form.get("username");
  const password = form.get("password");
  const avatar = form.get("avatar");

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0
  ) {
    return redirect("/signup?error=missing-fields");
  }

  if (!USERNAME_PATTERN.test(username)) {
    return redirect("/signup?error=invalid-username");
  }

  if (password.length < 8) {
    return redirect("/signup?error=short-password");
  }

  let avatarUrl: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    try {
      avatarUrl = await uploadAvatar(avatar, username.toLowerCase());
    } catch (err) {
      if (err instanceof InvalidAvatarError) {
        return redirect(`/signup?error=${err.code === "invalid-type" ? "invalid-avatar-type" : "avatar-too-large"}`);
      }
      throw err;
    }
  }

  const user = await createUser(firstName.trim(), lastName.trim(), username, password, avatarUrl);
  if (user === "duplicate") {
    return redirect("/signup?error=duplicate");
  }

  cookies.set(USER_COOKIE_NAME, createUserSessionToken(user.id), {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect("/");
};
```

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: Verify signup without a photo still works**

With the dev server running (note its actual port from the startup log):

```bash
curl -s -D - -o /dev/null http://localhost:4322/api/auth/signup \
  -F "firstName=Test" -F "lastName=NoPhoto" -F "username=testnophoto1" -F "password=password123"
```

Expected: `HTTP/1.1 302 Found` with `location: /` and a `set-cookie: user_session=...` header — i.e. signup still succeeds with no `avatar` field sent at all.

- [ ] **Step 5: Verify signup with a valid photo works**

```bash
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/test-avatar.png

curl -s -D - -o /dev/null http://localhost:4322/api/auth/signup \
  -F "firstName=Test" -F "lastName=WithPhoto" -F "username=testwithphoto1" -F "password=password123" \
  -F "avatar=@/tmp/test-avatar.png;type=image/png"
```

Expected: `HTTP/1.1 302 Found` with `location: /` and a `set-cookie` header. (If this instead redirects to `/signup?error=...`, check that `BLOB_READ_WRITE_TOKEN` is set in `.env` per Task 1 Step 4, and restart the dev server after adding it.)

- [ ] **Step 6: Verify an invalid file type is rejected**

```bash
echo "not an image" > /tmp/test-avatar.txt

curl -s -D - -o /dev/null http://localhost:4322/api/auth/signup \
  -F "firstName=Test" -F "lastName=BadType" -F "username=testbadtype1" -F "password=password123" \
  -F "avatar=@/tmp/test-avatar.txt;type=text/plain"
```

Expected: `HTTP/1.1 302 Found` with `location: /signup?error=invalid-avatar-type`, and **no** `set-cookie` header (account was not created).

- [ ] **Step 7: Verify an oversized file is rejected**

```bash
head -c 6000000 /dev/urandom > /tmp/test-avatar-big.bin
printf '\x89PNG\r\n\x1a\n' | cat - /tmp/test-avatar-big.bin > /tmp/test-avatar-big.png

curl -s -D - -o /dev/null http://localhost:4322/api/auth/signup \
  -F "firstName=Test" -F "lastName=TooBig" -F "username=testtoobig1" -F "password=password123" \
  -F "avatar=@/tmp/test-avatar-big.png;type=image/png"
```

Expected: `HTTP/1.1 302 Found` with `location: /signup?error=avatar-too-large`, and **no** `set-cookie` header.

- [ ] **Step 8: Clean up the test files and test users**

```bash
rm -f /tmp/test-avatar.png /tmp/test-avatar.txt /tmp/test-avatar-big.bin /tmp/test-avatar-big.png
```

The four test accounts (`testnophoto1`, `testwithphoto1`, `testbadtype1`, `testtoobig1` — the last one was never actually created, since that request was rejected) are harmless leftover rows — there's no user-deletion endpoint in this app (confirmed in the design doc's error-handling section), so leave them; they don't affect any other task or feature.

- [ ] **Step 9: Commit**

```bash
git add src/pages/signup.astro src/pages/api/auth/signup.ts
git commit -m "Accept an optional profile picture upload at signup"
```

---

## Task 5: `props.ts` — `playerUserId` and avatar resolution

**Files:**
- Modify: `src/lib/props.ts`

**Interfaces:**
- Consumes: `getCollection` from `src/lib/users.ts` (Task 2) — imported under an alias to avoid colliding with `props.ts`'s own `getCollection`.
- Produces: `PlayerPropDoc.playerUserId: ObjectId | null`, `PublicPlayerProp.playerUserId: string | null`, `PublicPlayerProp.playerAvatarUrl: string | null`, `CreatePropInput.playerUserId?: string | null`, `UpdatePropInput.playerUserId?: string | null`. All four list/get functions (`listPublicProps`, `listPublicPropsBySport`, `listAllProps`, `getPropById`) now return props with `playerAvatarUrl` populated.

- [ ] **Step 1: Add the import**

At the top of `src/lib/props.ts`, change:

```ts
import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
```

to:

```ts
import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getCollection as getUsersCollection } from "./users";
```

- [ ] **Step 2: Add `playerUserId` to both prop interfaces**

Change:

```ts
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
```

to:

```ts
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
```

Change:

```ts
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
```

to:

```ts
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
```

- [ ] **Step 3: Add `playerUserId` to the input types**

Change:

```ts
export interface CreatePropInput {
  sport: string;
  player: string;
  team: string | null;
  stat: string;
  line: number;
  startTime: Date;
}
```

to:

```ts
export interface CreatePropInput {
  sport: string;
  player: string;
  playerUserId?: string | null;
  team: string | null;
  stat: string;
  line: number;
  startTime: Date;
}
```

Change:

```ts
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
```

to:

```ts
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
```

- [ ] **Step 4: Update `toPublicProp`**

Change:

```ts
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
```

to:

```ts
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
```

(`playerAvatarUrl` starts `null` here and is filled in by `attachPlayerAvatars`, added in Step 5, which every list/get function now calls.)

- [ ] **Step 5: Add `attachPlayerAvatars`**

Add this function directly after `toPublicProp`:

```ts
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
```

- [ ] **Step 6: Call `attachPlayerAvatars` from every list/get function**

Change:

```ts
export async function listPublicProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled" })
    .sort({ startTime: 1 })
    .toArray();
  return docs.map(toPublicProp);
}
```

to:

```ts
export async function listPublicProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled" })
    .sort({ startTime: 1 })
    .toArray();
  return attachPlayerAvatars(docs.map(toPublicProp));
}
```

Change:

```ts
export async function listPublicPropsBySport(sport: string): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled", sport })
    .sort({ startTime: 1 })
    .toArray();
  return docs.map(toPublicProp);
}
```

to:

```ts
export async function listPublicPropsBySport(sport: string): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection
    .find({ status: "scheduled", sport })
    .sort({ startTime: 1 })
    .toArray();
  return attachPlayerAvatars(docs.map(toPublicProp));
}
```

Change:

```ts
export async function listAllProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublicProp);
}
```

to:

```ts
export async function listAllProps(): Promise<PublicPlayerProp[]> {
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return attachPlayerAvatars(docs.map(toPublicProp));
}
```

Change:

```ts
export async function getPropById(id: string): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toPublicProp(doc) : null;
}
```

to:

```ts
export async function getPropById(id: string): Promise<PublicPlayerProp | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  await promoteLiveProps(collection);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  const [withAvatar] = await attachPlayerAvatars([toPublicProp(doc)]);
  return withAvatar;
}
```

- [ ] **Step 7: Update `createProp`**

Change:

```ts
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
```

to:

```ts
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
```

- [ ] **Step 8: Update `updateProp`**

`playerUserId` needs converting from a string to an `ObjectId | null` before it's written — it can't just be spread into `$set` like the other fields, or MongoDB would store the raw string instead of an `ObjectId`. Change:

```ts
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
```

to:

```ts
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
```

- [ ] **Step 9: Type-check**

Run: `npx astro check`
Expected: `0 errors`. This will surface any other caller of `toPublicProp`/`createProp`/`updateProp` that needs updating — there shouldn't be any outside this file yet (the API routes touched in Task 6 are next).

- [ ] **Step 10: Commit**

```bash
git add src/lib/props.ts
git commit -m "Add playerUserId linking and batch avatar resolution to props"
```

---

## Task 6: Admin props API — accept `playerUserId`

**Files:**
- Modify: `src/pages/api/admin/props/index.ts`
- Modify: `src/pages/api/admin/props/[id].ts`

**Interfaces:**
- Consumes: `CreatePropInput`/`UpdatePropInput` with `playerUserId?: string | null` (Task 5), `getUserById` from `src/lib/users.ts` (already existed before this plan).
- Produces: both routes now 400 on a `playerUserId` that isn't a valid ObjectId or doesn't belong to an existing user.

- [ ] **Step 1: Update `index.ts`**

Change the top imports:

```ts
import type { APIRoute } from "astro";
import { createProp, listAllProps, type CreatePropInput } from "../../../../lib/props";
```

to:

```ts
import type { APIRoute } from "astro";
import { ObjectId } from "mongodb";
import { createProp, listAllProps, type CreatePropInput } from "../../../../lib/props";
import { getUserById } from "../../../../lib/users";
```

Change `parseCreateInput`'s return statement — from:

```ts
  const startTime = new Date(String(b.startTime));
  if (Number.isNaN(startTime.getTime())) return "startTime must be a valid date";

  return {
    sport: b.sport,
    player: b.player,
    stat: b.stat,
    line: b.line,
    team: (b.team as string | null | undefined) ?? null,
    startTime,
  };
}
```

to:

```ts
  const startTime = new Date(String(b.startTime));
  if (Number.isNaN(startTime.getTime())) return "startTime must be a valid date";

  let playerUserId: string | null = null;
  if (b.playerUserId !== undefined && b.playerUserId !== null) {
    if (typeof b.playerUserId !== "string" || !ObjectId.isValid(b.playerUserId)) {
      return "playerUserId must be a valid id";
    }
    playerUserId = b.playerUserId;
  }

  return {
    sport: b.sport,
    player: b.player,
    playerUserId,
    stat: b.stat,
    line: b.line,
    team: (b.team as string | null | undefined) ?? null,
    startTime,
  };
}
```

Change the `POST` handler from:

```ts
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseCreateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const prop = await createProp(parsed);
  return jsonResponse({ prop }, 201);
};
```

to:

```ts
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseCreateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  if (parsed.playerUserId) {
    const user = await getUserById(parsed.playerUserId);
    if (!user) return jsonResponse({ error: "playerUserId does not reference an existing user" }, 400);
  }

  const prop = await createProp(parsed);
  return jsonResponse({ prop }, 201);
};
```

- [ ] **Step 2: Update `[id].ts`**

Change the top imports:

```ts
import type { APIRoute } from "astro";
import {
  deleteProp,
  getPropById,
  updateProp,
  type PropResult,
  type UpdatePropInput,
} from "../../../../lib/props";
import { settleBetsForProp } from "../../../../lib/bets";
```

to:

```ts
import type { APIRoute } from "astro";
import { ObjectId } from "mongodb";
import {
  deleteProp,
  getPropById,
  updateProp,
  type PropResult,
  type UpdatePropInput,
} from "../../../../lib/props";
import { settleBetsForProp } from "../../../../lib/bets";
import { getUserById } from "../../../../lib/users";
```

In `parseUpdateInput`, add this block right after the existing `if (b.player !== undefined) { ... }` block (before the `if (b.team !== undefined)` block):

```ts
  if (b.playerUserId !== undefined) {
    if (b.playerUserId !== null) {
      if (typeof b.playerUserId !== "string" || !ObjectId.isValid(b.playerUserId)) {
        return "playerUserId must be a valid id or null";
      }
    }
    input.playerUserId = b.playerUserId as string | null;
  }
```

Change the `PATCH` handler from:

```ts
export const PATCH: APIRoute = async ({ params, request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseUpdateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const prop = await updateProp(params.id!, parsed);
  if (!prop) return jsonResponse({ error: "Not found" }, 404);
```

to:

```ts
export const PATCH: APIRoute = async ({ params, request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseUpdateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  if (parsed.playerUserId) {
    const user = await getUserById(parsed.playerUserId);
    if (!user) return jsonResponse({ error: "playerUserId does not reference an existing user" }, 400);
  }

  const prop = await updateProp(params.id!, parsed);
  if (!prop) return jsonResponse({ error: "Not found" }, 404);
```

(The rest of the `PATCH` handler — the `settleBetsForProp`/`deleteProp` block and the closing return — is unchanged.)

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: Verify with curl**

You'll need a logged-in admin session cookie. Log in first and capture it:

```bash
curl -s -c /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}\n" \
  http://localhost:4322/api/admin/login -d "password=$(grep ^ADMIN_PASSWORD= .env | cut -d= -f2-)"
```

Expected: `302`.

Create a prop with an invalid `playerUserId`:

```bash
curl -s -b /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:4322/api/admin/props \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","player":"Test","playerUserId":"not-a-valid-id","stat":"Points","line":10,"startTime":"2027-01-01T00:00:00.000Z"}'
```

Expected: `400`.

Create a prop with a `playerUserId` that's a well-formed but nonexistent ObjectId:

```bash
curl -s -b /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:4322/api/admin/props \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","player":"Test","playerUserId":"000000000000000000000000","stat":"Points","line":10,"startTime":"2027-01-01T00:00:00.000Z"}'
```

Expected: `400`.

Create a prop with no `playerUserId` at all (existing free-text behavior must still work):

```bash
curl -s -b /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:4322/api/admin/props \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","player":"Free Text Player","stat":"Points","line":10,"startTime":"2027-01-01T00:00:00.000Z"}'
```

Expected: `201`. Clean this one up so it doesn't clutter the admin props list:

```bash
curl -s -b /tmp/admin-cookies.txt http://localhost:4322/api/admin/props | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=JSON.parse(d).props.find(p=>p.player==='Free Text Player');if(p)console.log(p.id)})"
```

Take the printed id and:

```bash
curl -s -b /tmp/admin-cookies.txt -X DELETE http://localhost:4322/api/admin/props/<id-from-above> -o /dev/null -w "%{http_code}\n"
```

Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/props/index.ts "src/pages/api/admin/props/[id].ts"
git commit -m "Validate playerUserId in the admin props API"
```

---

## Task 7: Admin prop form — registered-users dropdown

**Files:**
- Modify: `src/pages/admin/props.astro`

**Interfaces:**
- Consumes: `listAllUsers` from `src/lib/users.ts` (Task 2).
- Produces: player `<select>` options valued `user:<id>` for registered users, consumed by `src/scripts/adminProps.js` in Task 8.

- [ ] **Step 1: Load users and update the player select**

Change the frontmatter imports and data-loading:

```astro
---
import Layout from "../../layouts/Layout.astro";
import { listAllProps } from "../../lib/props";
import { listOptionSets } from "../../lib/propOptions";

const props = await listAllProps();
const { sport: sportOptions, player: playerOptions, stat: statOptions } = await listOptionSets();
---
```

to:

```astro
---
import Layout from "../../layouts/Layout.astro";
import { listAllProps } from "../../lib/props";
import { listOptionSets } from "../../lib/propOptions";
import { listAllUsers } from "../../lib/users";

const props = await listAllProps();
const { sport: sportOptions, player: playerOptions, stat: statOptions } = await listOptionSets();
const users = await listAllUsers();
---
```

Change the player `<select>` block from:

```astro
      <label for="player">Player</label>
      <select id="player" name="player" required>
        <option value="" disabled selected>Select player...</option>
        {playerOptions.map((option) => <option value={option}>{option}</option>)}
        <option value="__add_new__">+ Add New...</option>
      </select>
```

to:

```astro
      <label for="player">Player</label>
      <select id="player" name="player" required>
        <option value="" disabled selected>Select player...</option>
        <optgroup label="Registered Users">
          {users.map((user) => (
            <option value={`user:${user.id}`}>{user.firstName} {user.lastName} (@{user.username})</option>
          ))}
        </optgroup>
        <optgroup label="Other Players">
          {playerOptions.map((option) => <option value={option}>{option}</option>)}
        </optgroup>
        <option value="__add_new__">+ Add New...</option>
      </select>
```

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Verify in the browser**

Log in to `/admin/login`, go to `/admin/props`, open the "Player" dropdown. Expected: a "Registered Users" group listing every signed-up user as `First Last (@username)`, followed by an "Other Players" group with the existing free-text names, followed by "+ Add New...". (This is inert until Task 8 wires up the submit logic — selecting a registered user and submitting right now would send the literal string `user:<id>` as the `player` field, which Task 8 fixes.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/props.astro
git commit -m "List registered users in the admin prop form's player dropdown"
```

---

## Task 8: Admin form client script — resolve `user:` values

**Files:**
- Modify: `src/scripts/adminProps.js`

**Interfaces:**
- Consumes: `user:<id>` option values from Task 7.
- Produces: `playerUserId` in the request body sent to `/api/admin/props` (Task 6 validates it), correct edit-mode preselection, and a fixed random-seed player pool that excludes registered-user options.

- [ ] **Step 1: Fix `optionValues` to exclude `user:` options from the random-seed pool**

Change:

```js
function optionValues(selectId, fallback) {
  const select = document.getElementById(selectId);
  const values = select
    ? Array.from(select.options)
        .map((opt) => opt.value)
        .filter((value) => value && value !== ADD_NEW_VALUE)
    : [];
  return values.length > 0 ? values : fallback;
}
```

to:

```js
function optionValues(selectId, fallback) {
  const select = document.getElementById(selectId);
  const values = select
    ? Array.from(select.options)
        .map((opt) => opt.value)
        .filter((value) => value && value !== ADD_NEW_VALUE && !value.startsWith("user:"))
    : [];
  return values.length > 0 ? values : fallback;
}
```

(Without this, "Seed Random Props" would occasionally pick a `user:<id>` string as a literal, garbage `player` name — it reads `select.options` directly, which now includes the registered-users optgroup added in Task 7.)

- [ ] **Step 2: Resolve `playerUserId` on submit**

Change the submit handler's body-building code from:

```js
    const startTimeValue = document.getElementById("startTime").value;
    const body = {
      sport: document.getElementById("sport").value,
      player: document.getElementById("player").value,
      team: document.getElementById("team").value || null,
      stat: document.getElementById("stat").value,
      line: Number(document.getElementById("line").value),
      startTime: new Date(startTimeValue).toISOString(),
    };
```

to:

```js
    const startTimeValue = document.getElementById("startTime").value;
    const playerSelect = document.getElementById("player");
    const playerRaw = playerSelect.value;
    const isRegisteredUser = playerRaw.startsWith("user:");
    const body = {
      sport: document.getElementById("sport").value,
      player: isRegisteredUser
        ? playerSelect.options[playerSelect.selectedIndex].textContent
        : playerRaw,
      playerUserId: isRegisteredUser ? playerRaw.slice("user:".length) : null,
      team: document.getElementById("team").value || null,
      stat: document.getElementById("stat").value,
      line: Number(document.getElementById("line").value),
      startTime: new Date(startTimeValue).toISOString(),
    };
```

- [ ] **Step 3: Preselect the registered-user option in edit mode**

Change:

```js
function populateFormForEdit(prop) {
  idField.value = prop.id;
  document.getElementById("sport").value = prop.sport;
  document.getElementById("player").value = prop.player;
  document.getElementById("team").value = prop.team ?? "";
```

to:

```js
function populateFormForEdit(prop) {
  idField.value = prop.id;
  document.getElementById("sport").value = prop.sport;
  document.getElementById("player").value = prop.playerUserId ? `user:${prop.playerUserId}` : prop.player;
  document.getElementById("team").value = prop.team ?? "";
```

- [ ] **Step 4: Verify in the browser**

At `/admin/props`:
1. Pick a registered user in the "Player" dropdown, fill in the rest of the form, submit. Expected: the new card shows the user's `First Last` as the player name (open the browser's Network tab or re-run the Task 6 curl-style check against `/api/admin/props` to confirm the created prop has a non-null `playerUserId`).
2. Click "Edit" on that same card. Expected: the "Player" dropdown re-selects that same registered user (not "Select player...").
3. Click "Seed Random Props (Test)" a few times. Expected: none of the generated props ever have a `player` value that looks like `user:507f1f77bcf86cd799439011` — only real names.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/adminProps.js
git commit -m "Resolve registered-user selections in the admin prop form"
```

---

## Task 9: Render the avatar on prop cards

**Files:**
- Modify: `src/components/Home.astro`
- Modify: `src/pages/admin/props.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `prop.playerAvatarUrl` (Task 5), `/avatar-placeholder.svg` (Task 3).

- [ ] **Step 1: Add the avatar image to the public card**

In `src/components/Home.astro`, change:

```astro
          <div /*key={prop.id}*/ class="card player-prop">
            <h1 class="player">{prop.player}</h1>
```

to:

```astro
          <div /*key={prop.id}*/ class="card player-prop">
            <img class="prop-avatar" src={prop.playerAvatarUrl ?? "/avatar-placeholder.svg"} alt="" />
            <h1 class="player">{prop.player}</h1>
```

- [ ] **Step 2: Add the avatar image to the admin card**

In `src/pages/admin/props.astro`, change:

```astro
        <div class="card admin-prop" data-prop={JSON.stringify(prop)}>
          <h1 class="player">{prop.player}</h1>
```

to:

```astro
        <div class="card admin-prop" data-prop={JSON.stringify(prop)}>
          <img class="prop-avatar" src={prop.playerAvatarUrl ?? "/avatar-placeholder.svg"} alt="" />
          <h1 class="player">{prop.player}</h1>
```

- [ ] **Step 3: Add the CSS**

In `src/styles/global.css`, add this immediately before the existing `.player {` rule:

```css
.prop-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  margin: 0 auto var(--space-3);
  border: 2px solid rgba(255, 255, 255, 0.08);
  background-color: var(--secondary-bg);
}

```

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 5: Verify end-to-end in the browser**

1. Sign up a new account with a real photo at `/signup`.
2. Log in to `/admin/login`, go to `/admin/props`, create a prop and pick that new account in the "Registered Users" group.
3. Visit `/` (or `/leagues/<sport>`) as a regular user. Expected: that prop's card shows a circular avatar (the uploaded photo) centered above the player name.
4. Back on `/admin/props`, confirm the same card there also shows the photo.
5. Create a second prop using a free-text player name (not linked to any user). Expected: its card shows the generic placeholder silhouette, on both `/admin/props` and the public listing.

- [ ] **Step 6: Commit**

```bash
git add src/components/Home.astro src/pages/admin/props.astro src/styles/global.css
git commit -m "Show the linked user's photo, or a placeholder, on player prop cards"
```

---

## Post-plan note

Deploying this to Vercel (per the design doc's noted out-of-scope item) will additionally require switching `astro.config.mjs` from `@astrojs/node` to `@astrojs/vercel`, and setting `BLOB_READ_WRITE_TOKEN` in the Vercel project's environment variables (not just local `.env`). Neither is part of this plan.
