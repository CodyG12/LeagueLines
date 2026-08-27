# My Bets Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/my-bets` Live Bets and Past Bets sections from plain text-list cards into rich per-bet cards (header with mode/stake/multiplier/outcome, per-leg rows with player photo/subtitle/pick/progress indicator), matching a reference screenshot adapted into LeagueLines' own design system.

**Architecture:** `BetLeg`/`PublicBetLeg` gain `team`, `playerUserId`, and `finalValue` fields so a bet leg remembers what the prop looked like when it was placed and what it graded to. The admin "Close & Grade" form gains an optional final-value input that flows through `settleBetsForProp` onto the matching leg. A new `BetEntryCard.astro` sub-component (shared by both Live Bets and Past Bets, since they render the identical card shape) replaces the flat list markup in `my-bets.astro`. Everything is server-rendered Astro + CSS — no React island, no client-side state.

**Tech Stack:** Astro (server output), MongoDB driver, vanilla CSS (existing `DESIGN.md` tokens only), existing vanilla JS (`myBets.js`'s counter animation / win-celebration — unchanged, just retargeted at new markup).

Full design rationale: `docs/superpowers/specs/2026-08-26-my-bets-card-redesign-design.md`. Read it if anything below is ambiguous.

## Global Constraints

- This codebase has **no automated test framework** (no test runner in `package.json`, no `*.test.*` files). Verify every task with `npx astro check` (0 errors required) plus manual `curl`/browser verification against the dev server (`npm run dev`) — matching every prior plan in `docs/superpowers/plans/`.
- **No React island for this feature.** Server-rendered Astro markup + CSS only — this page has zero interactivity.
- **`finalValue` is optional everywhere** — never required to close a prop, never required in the admin form. A leg graded without one still renders correctly (a ✓/✕/= glyph instead of a number).
- **Use only existing `DESIGN.md` tokens** — no new colors, fonts, or radii. The pending/live state uses `--accent-purple` (matching the page's own "Live Bets" heading, which already uses it); won/lost/pushed use `--success-color`/`--danger-color`/`--secondary-text`.
- **The progress bar is a decorative resolved/unresolved indicator, not a proportional plot** of `finalValue` against `line` — empty/muted track while `pending`, a full-width colored fill once graded, never a percentage-scaled fill.
- **Old bets** (placed before this ships) have `team`/`playerUserId`/`finalValue` as `undefined` — must render without errors, treated as `null` throughout (sport-only subtitle, sprite avatar, glyph-only progress pill).
- Follow existing code style: no comments except where a non-obvious constraint needs explaining (this repo's files have almost none).

---

## Task 1: `BetLeg`/`PublicBetLeg` schema + capture `team`/`playerUserId` at bet time

**Files:**
- Modify: `src/lib/bets.ts`

**Interfaces:**
- Consumes: nothing new (uses the existing `PublicPlayerProp` shape from `src/lib/props.ts`, which already has `playerUserId: string | null` and `team: string | null`).
- Produces: `BetLeg.team: string | null`, `BetLeg.playerUserId: ObjectId | null`, `PublicBetLeg.team`, `PublicBetLeg.playerUserId: string | null`, `PublicBetLeg.playerAvatarUrl: string | null` (always `null` until Task 5's `attachLegAvatars` resolves it), `BetLeg.finalValue: number | null` / `PublicBetLeg.finalValue: number | null` (always `null` until Task 2 sets it at grading time — declared now so the interfaces and `toPublicBet` mapping are complete in one pass).

- [ ] **Step 1: Extend `BetLeg` and `PublicBetLeg`**

In `src/lib/bets.ts`, change:

```ts
export interface BetLeg {
  propId: ObjectId;
  sport: string;
  player: string;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
}
```

to:

```ts
export interface BetLeg {
  propId: ObjectId;
  sport: string;
  player: string;
  playerUserId: ObjectId | null;
  team: string | null;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
  finalValue: number | null;
}
```

Change:

```ts
export interface PublicBetLeg {
  propId: string;
  sport: string;
  player: string;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
}
```

to:

```ts
export interface PublicBetLeg {
  propId: string;
  sport: string;
  player: string;
  playerUserId: string | null;
  playerAvatarUrl: string | null;
  team: string | null;
  stat: string;
  line: number;
  pick: "over" | "under";
  legResult: LegResult;
  finalValue: number | null;
}
```

- [ ] **Step 2: Update `toPublicBet` to map the new leg fields**

Change:

```ts
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
```

to:

```ts
export function toPublicBet(doc: BetDoc): PublicBet {
  return {
    id: doc._id.toString(),
    mode: doc.mode,
    legs: doc.legs.map((leg) => ({
      propId: leg.propId.toString(),
      sport: leg.sport,
      player: leg.player,
      playerUserId: leg.playerUserId ? leg.playerUserId.toString() : null,
      playerAvatarUrl: null,
      team: leg.team,
      stat: leg.stat,
      line: leg.line,
      pick: leg.pick,
      legResult: leg.legResult,
      finalValue: leg.finalValue,
    })),
    stake: doc.stake,
    potentialPayout: doc.potentialPayout,
    status: doc.status,
    payout: doc.payout,
    createdAt: doc.createdAt.toISOString(),
    settledAt: doc.settledAt ? doc.settledAt.toISOString() : null,
  };
}
```

- [ ] **Step 3: Copy `team`/`playerUserId` from the prop in `placeBets()`, initialize `finalValue: null`**

In `placeBets()`, change:

```ts
    legs.push({
      propId: new ObjectId(prop.id),
      sport: prop.sport,
      player: prop.player,
      stat: prop.stat,
      line: prop.line,
      pick: pick.pick,
      legResult: "pending",
    });
```

to:

```ts
    legs.push({
      propId: new ObjectId(prop.id),
      sport: prop.sport,
      player: prop.player,
      playerUserId: prop.playerUserId ? new ObjectId(prop.playerUserId) : null,
      team: prop.team,
      stat: prop.stat,
      line: prop.line,
      pick: pick.pick,
      legResult: "pending",
      finalValue: null,
    });
```

(`prop` here is the `PublicPlayerProp` returned by `getPropById` a few lines above this block — it already has `playerUserId: string | null` and `team: string | null`.)

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: `0 errors`. This will flag any other file constructing a `BetLeg`/`PublicBetLeg` literal that's now missing a required field — there should be none yet (Task 5 handles `listBetsForUser`'s output, which doesn't construct `BetLeg`/`PublicBetLeg` literals directly, only maps over what `toPublicBet` already produces).

- [ ] **Step 5: Verify by placing a bet and inspecting the response**

With the dev server running and logged in as a regular user, place any single bet through the UI at `/`, then check the bet was stored with the new fields:

```bash
curl -s -b /tmp/user-cookies.txt http://localhost:4321/api/bets | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).bets[0];console.log(JSON.stringify({team:b.legs[0].team,playerUserId:b.legs[0].playerUserId,finalValue:b.legs[0].finalValue},null,2))})"
```

(If you don't already have a saved user session cookie jar, log in first: `curl -s -c /tmp/user-cookies.txt -o /dev/null http://localhost:4321/api/auth/login -d "username=<your-username>&password=<your-password>"` — adjust the port to match the dev server's actual startup log.)

Expected: `team` matches the prop's team (or `null` if it had none), `playerUserId` is either `null` or a valid id string depending on whether the prop was linked to a registered user, `finalValue` is `null`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bets.ts
git commit -m "Capture team and playerUserId on bet legs at placement time"
```

---

## Task 2: `settleBetsForProp` accepts and stores `finalValue`

**Files:**
- Modify: `src/lib/bets.ts`

**Interfaces:**
- Consumes: `BetLeg.finalValue`, `PublicBetLeg.finalValue` (Task 1).
- Produces: `settleBetsForProp(propId: string, result: "over" | "under" | "push", finalValue?: number | null): Promise<string[]>` — third parameter, defaults to `null`. Consumed by Task 3's admin API route.

- [ ] **Step 1: Add the `finalValue` parameter and write it onto the matching leg**

In `src/lib/bets.ts`, change:

```ts
export async function settleBetsForProp(
  propId: string,
  result: "over" | "under" | "push",
): Promise<string[]> {
  if (!ObjectId.isValid(propId)) return [];
  const propObjectId = new ObjectId(propId);
  const collection = await getCollection();
  const settledUserIds = new Set<string>();

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
```

to:

```ts
export async function settleBetsForProp(
  propId: string,
  result: "over" | "under" | "push",
  finalValue: number | null = null,
): Promise<string[]> {
  if (!ObjectId.isValid(propId)) return [];
  const propObjectId = new ObjectId(propId);
  const collection = await getCollection();
  const settledUserIds = new Set<string>();

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
        $set: { "legs.$[leg].legResult": legResult, "legs.$[leg].finalValue": finalValue },
        $inc: { pendingLegCount: -1 },
      },
      {
        arrayFilters: [{ "leg.propId": propObjectId, "leg.legResult": "pending" }],
        returnDocument: "after",
      },
    );
    if (!updated) continue;
```

(The rest of the function — the `pendingLegCount <= 0` settlement block and the closing `return` — is unchanged.)

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: `0 errors`. The one existing caller in `src/pages/api/admin/props/[id].ts` (`settleBetsForProp(prop.id, parsed.result)`) still compiles unchanged, since the new parameter has a default.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bets.ts
git commit -m "Let settleBetsForProp record a final graded value per leg"
```

---

## Task 3: Admin API accepts `finalValue` when grading a prop

**Files:**
- Modify: `src/pages/api/admin/props/[id].ts`

**Interfaces:**
- Consumes: `settleBetsForProp(propId, result, finalValue?)` (Task 2).
- Produces: `PATCH /api/admin/props/:id` now accepts an optional top-level `finalValue: number | null` in its JSON body, threaded to `settleBetsForProp` when closing a prop. Consumed by Task 4's admin form.

- [ ] **Step 1: Add a `parseFinalValue` helper**

In `src/pages/api/admin/props/[id].ts`, add this function directly after `parseUpdateInput` (before the `export const GET` block):

```ts
function parseFinalValue(body: unknown): number | null | string {
  const raw = (body as Record<string, unknown> | null)?.finalValue;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return "finalValue must be a number or null";
  return raw;
}
```

(`finalValue` isn't a `PlayerPropDoc` field — it only ever lives on the bet legs it settles — so it's parsed separately from `parseUpdateInput`/`UpdatePropInput` rather than added to that type.)

- [ ] **Step 2: Validate and thread it through in `PATCH`**

Change:

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

  if (parsed.status === "closed" && parsed.result) {
    const settledUserIds = await settleBetsForProp(prop.id, parsed.result);
    await Promise.all(settledUserIds.map((userId) => checkAndAwardBadges(userId)));
    await deleteProp(prop.id);
  }

  return jsonResponse({ prop }, 200);
};
```

to:

```ts
export const PATCH: APIRoute = async ({ params, request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseUpdateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const finalValue = parseFinalValue(body);
  if (typeof finalValue === "string") return jsonResponse({ error: finalValue }, 400);

  if (parsed.playerUserId) {
    const user = await getUserById(parsed.playerUserId);
    if (!user) return jsonResponse({ error: "playerUserId does not reference an existing user" }, 400);
  }

  const prop = await updateProp(params.id!, parsed);
  if (!prop) return jsonResponse({ error: "Not found" }, 404);

  if (parsed.status === "closed" && parsed.result) {
    const settledUserIds = await settleBetsForProp(prop.id, parsed.result, finalValue);
    await Promise.all(settledUserIds.map((userId) => checkAndAwardBadges(userId)));
    await deleteProp(prop.id);
  }

  return jsonResponse({ prop }, 200);
};
```

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: Verify with curl**

Get an admin session cookie:

```bash
curl -s -c /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}\n" \
  http://localhost:4321/api/admin/login -d "password=$(grep ^ADMIN_PASSWORD= .env | cut -d= -f2-)"
```

Expected: `302`.

Create a throwaway prop, place a bet on it as a regular user, then close it with a `finalValue`:

```bash
curl -s -b /tmp/admin-cookies.txt http://localhost:4321/api/admin/props \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","player":"Plan Test Player","stat":"Points","line":20,"startTime":"2020-01-01T00:00:00.000Z"}'
```

Note the returned prop's `id`, then:

```bash
curl -s -b /tmp/admin-cookies.txt -X PATCH http://localhost:4321/api/admin/props/<id-from-above> \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","result":"over","finalValue":24}' -w "\n%{http_code}\n"
```

Expected: `200`, and (if a bet was placed on it first) that bet's leg now has `finalValue: 24` when fetched via `/api/bets` as that user.

Then verify the optional case — create another throwaway prop and close it **without** `finalValue`:

```bash
curl -s -b /tmp/admin-cookies.txt -X PATCH http://localhost:4321/api/admin/props/<second-id> \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","result":"push"}' -w "\n%{http_code}\n"
```

Expected: `200` (not a validation error) — closing without `finalValue` must still work.

Then verify rejection of a bad type:

```bash
curl -s -b /tmp/admin-cookies.txt -X PATCH http://localhost:4321/api/admin/props/<any-open-prop-id> \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","result":"over","finalValue":"not-a-number"}' -w "\n%{http_code}\n"
```

Expected: `400`.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/api/admin/props/[id].ts"
git commit -m "Accept an optional finalValue when grading a prop via the admin API"
```

---

## Task 4: Admin "Close & Grade" form gets a final-value input

**Files:**
- Modify: `src/pages/admin/props.astro`
- Modify: `src/scripts/adminProps.js`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PATCH /api/admin/props/:id` accepting `finalValue` (Task 3).
- Produces: nothing consumed by later tasks (this is the last piece of the admin-side work).

- [ ] **Step 1: Add the input to the close-form markup**

In `src/pages/admin/props.astro`, change:

```astro
              <form class="close-form">
                <select name="result" required>
                  <option value="" disabled selected>
                    Grade result...
                  </option>
                  <option value="over">Over</option>
                  <option value="under">Under</option>
                  <option value="push">Push</option>
                </select>
                <button type="submit" class="secondary-btn">
                  Close & Grade
                </button>
              </form>
```

to:

```astro
              <form class="close-form">
                <select name="result" required>
                  <option value="" disabled selected>
                    Grade result...
                  </option>
                  <option value="over">Over</option>
                  <option value="under">Under</option>
                  <option value="push">Push</option>
                </select>
                <input type="number" step="0.5" name="finalValue" placeholder="Final value (optional)" />
                <button type="submit" class="secondary-btn">
                  Close & Grade
                </button>
              </form>
```

- [ ] **Step 2: Read and send `finalValue` on submit**

In `src/scripts/adminProps.js`, change:

```js
  const closeForm = card.querySelector(".close-form");
  closeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = new FormData(closeForm).get("result");
    if (!result) return;

    const response = await fetch(`/api/admin/props/${prop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", result }),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert("Failed to close prop.");
    }
  });
```

to:

```js
  const closeForm = card.querySelector(".close-form");
  closeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(closeForm);
    const result = formData.get("result");
    if (!result) return;

    const finalValueRaw = formData.get("finalValue");
    const finalValue = finalValueRaw && finalValueRaw.trim() !== "" ? Number(finalValueRaw) : null;

    const response = await fetch(`/api/admin/props/${prop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", result, finalValue }),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert("Failed to close prop.");
    }
  });
```

- [ ] **Step 3: Let the new input wrap/size like the rest of the close-form**

In `src/styles/global.css`, find:

```css
.close-form {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  justify-content: center;
}
```

Replace with:

```css
.close-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
  justify-content: center;
}

.close-form input {
  flex: 1 1 140px;
  min-width: 0;
}
```

Then find the mobile block:

```css
  .close-form select,
  .close-form button {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font-size: 0.8rem;
  }
```

Replace with:

```css
  .close-form select,
  .close-form input,
  .close-form button {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font-size: 0.8rem;
  }
```

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 5: Verify in the browser**

Log in at `/admin/login`, go to `/admin/props`:
1. Create a test prop, then use its "Close & Grade" form: pick a result, type a number into the new "Final value (optional)" field, submit. Expected: prop closes successfully (card disappears after reload, per existing behavior).
2. Create another test prop, grade it **without** touching the final-value field. Expected: still closes successfully — confirms the field is genuinely optional end to end.
3. Resize to a narrow (~375px) width and confirm the result select, the final-value input, and the submit button each stack to full width without overflowing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/props.astro src/scripts/adminProps.js src/styles/global.css
git commit -m "Add an optional final-value field to the admin grading form"
```

---

## Task 5: Resolve leg avatars in `listBetsForUser`

**Files:**
- Modify: `src/lib/bets.ts`

**Interfaces:**
- Consumes: `PublicBetLeg.playerUserId`, `PublicBetLeg.playerAvatarUrl` (Task 1); `pickSpriteFor(seed: string): SpriteAvatar` from `src/lib/sprites.ts` (pre-existing); `getCollection` from `src/lib/users.ts` (pre-existing, aliased).
- Produces: `listBetsForUser`'s returned `PublicBet[]` now has every leg's `playerAvatarUrl` populated (a real photo if `playerUserId` is set and that user has one, otherwise a deterministic sprite) — consumed by Task 6's `BetEntryCard.astro`.

- [ ] **Step 1: Import what's needed**

In `src/lib/bets.ts`, change:

```ts
import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getPropById } from "./props";
import { creditUnits, debitUnits } from "./users";
```

to:

```ts
import { ObjectId, type Collection } from "mongodb";
import clientPromise from "./mongodb";
import { getPropById } from "./props";
import { creditUnits, debitUnits, getCollection as getUsersCollection } from "./users";
import { pickSpriteFor } from "./sprites";
```

- [ ] **Step 2: Add `attachLegAvatars`**

Add this function directly after `toPublicBet` (before `placeBets`):

```ts
async function attachLegAvatars(bets: PublicBet[]): Promise<PublicBet[]> {
  const ids = Array.from(
    new Set(
      bets.flatMap((b) => b.legs.map((leg) => leg.playerUserId)).filter((id): id is string => id !== null),
    ),
  );

  let avatarById = new Map<string, string | null>();
  if (ids.length > 0) {
    const usersCollection = await getUsersCollection();
    const users = await usersCollection
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { avatarUrl: 1 } })
      .toArray();
    avatarById = new Map(users.map((u) => [u._id.toString(), u.avatarUrl ?? null]));
  }

  return bets.map((b) => ({
    ...b,
    legs: b.legs.map((leg) => {
      const resolved = leg.playerUserId ? (avatarById.get(leg.playerUserId) ?? null) : null;
      return { ...leg, playerAvatarUrl: resolved ?? pickSpriteFor(leg.propId) };
    }),
  }));
}
```

(Structurally identical to `attachPlayerAvatars` in `src/lib/props.ts` — same real-photo-or-deterministic-sprite fallback — just operating over every leg of every bet instead of over a flat list of props.)

- [ ] **Step 3: Call it from `listBetsForUser`**

Change:

```ts
export async function listBetsForUser(userId: string): Promise<PublicBet[]> {
  if (!ObjectId.isValid(userId)) return [];
  const collection = await getCollection();
  const docs = await collection
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toPublicBet);
}
```

to:

```ts
export async function listBetsForUser(userId: string): Promise<PublicBet[]> {
  if (!ObjectId.isValid(userId)) return [];
  const collection = await getCollection();
  const docs = await collection
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return attachLegAvatars(docs.map(toPublicBet));
}
```

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 5: Verify with curl**

```bash
curl -s -b /tmp/user-cookies.txt http://localhost:4321/api/bets | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).bets;console.log(b.map(x=>x.legs.map(l=>l.playerAvatarUrl)))})"
```

Expected: every leg has a non-null `playerAvatarUrl` — either a real `https://...blob.vercel-storage.com/...` URL (if that leg's `playerUserId` belongs to a user with an uploaded photo) or a `/sprites/....svg` path (fallback).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bets.ts
git commit -m "Resolve real or sprite-fallback avatars for bet legs"
```

---

## Task 6: `BetEntryCard.astro` component and its styling

**Files:**
- Create: `src/components/sub_components/BetEntryCard.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `PublicBet` type from `src/lib/bets.ts` (`{ id, mode, legs: PublicBetLeg[], stake, potentialPayout, status, payout, createdAt, settledAt }`, where each `PublicBetLeg` has `player, playerAvatarUrl, team, sport, stat, line, pick, legResult, finalValue` per Tasks 1 and 5).
- Produces: `BetEntryCard` component accepting `{ bet: PublicBet }` — consumed by Task 7's `my-bets.astro`.

- [ ] **Step 1: Create `src/components/sub_components/BetEntryCard.astro`**

```astro
---
import type { PublicBet, LegResult } from "../../lib/bets";

interface Props {
  bet: PublicBet;
}

const { bet } = Astro.props;

const multiplier = bet.potentialPayout / bet.stake;
const modeLabel = bet.legs.length === 1 ? "Single Bet" : `${bet.legs.length}-Leg Parlay`;

function formatPlacedDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function legResultModifier(legResult: LegResult): "pending" | "win" | "loss" | "push" {
  if (legResult === "win") return "win";
  if (legResult === "loss") return "loss";
  if (legResult === "push") return "push";
  return "pending";
}

function legResultGlyph(legResult: LegResult): string {
  if (legResult === "win") return "✓";
  if (legResult === "loss") return "✕";
  if (legResult === "push") return "=";
  return "";
}
---

<div class="bet-entry-card">
  <div class="bet-entry-header">
    <div class="bet-entry-header-left">
      <span class="bet-entry-mode">{modeLabel}</span>
      <span class="bet-entry-stake">
        {bet.stake} units @ {multiplier.toFixed(1)}x
      </span>
    </div>
    <div class="bet-entry-header-right">
      {
        bet.status === "pending" && (
          <span class="bet-entry-outcome bet-entry-outcome--pending">
            Potential +<span data-animate-number={bet.potentialPayout - bet.stake}>0</span> units
          </span>
        )
      }
      {
        bet.status === "won" && (
          <span class="bet-entry-outcome bet-entry-outcome--won">
            +<span data-animate-number={(bet.payout ?? 0) - bet.stake}>0</span> units
          </span>
        )
      }
      {
        bet.status === "lost" && (
          <span class="bet-entry-outcome bet-entry-outcome--lost">
            -<span data-animate-number={bet.stake}>0</span> units
          </span>
        )
      }
      {
        bet.status === "pushed" && (
          <span class="bet-entry-outcome bet-entry-outcome--pushed">Push · stake returned</span>
        )
      }
    </div>
  </div>

  <div class="bet-entry-legs">
    {
      bet.legs.map((leg) => (
        <div class="bet-leg">
          <img class="bet-leg-avatar" src={leg.playerAvatarUrl} alt="" loading="lazy" />
          <div class="bet-leg-info">
            <span class="bet-leg-name">{leg.player}</span>
            <span class="bet-leg-subtitle">
              {leg.sport}
              {leg.team ? ` • ${leg.team}` : ""}
            </span>
          </div>
          <div class={`bet-leg-pick bet-leg-pick--${legResultModifier(leg.legResult)}`}>
            <span class="bet-leg-pick-value">
              {leg.pick === "over" ? "Over" : "Under"} {leg.line}
            </span>
            <span class="bet-leg-pick-stat">{leg.stat}</span>
          </div>
          <div class="bet-leg-progress-row">
            <div class="bet-leg-progress-track">
              {leg.legResult !== "pending" && (
                <div class={`bet-leg-progress-fill bet-leg-progress-fill--${legResultModifier(leg.legResult)}`} />
              )}
            </div>
            {leg.legResult !== "pending" && (
              <span class={`bet-leg-progress-pill bet-leg-progress-pill--${legResultModifier(leg.legResult)}`}>
                {typeof leg.finalValue === "number" ? leg.finalValue : legResultGlyph(leg.legResult)}
              </span>
            )}
          </div>
        </div>
      ))
    }
  </div>

  <div class="bet-entry-footer">Placed {formatPlacedDate(bet.createdAt)}</div>
</div>
```

- [ ] **Step 2: Append the card CSS**

Add this block at the end of `src/styles/global.css`:

```css

/* My Bets — bet entry cards */
.bet-entry-card {
  background-color: var(--secondary-bg);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bet-entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.bet-entry-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bet-entry-header-right {
  display: flex;
  align-items: center;
}

.bet-entry-mode {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--primary-text);
}

.bet-entry-stake {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: var(--secondary-text);
}

.bet-entry-outcome {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 1.1rem;
  white-space: nowrap;
}

.bet-entry-outcome--pending {
  color: var(--accent-purple);
}

.bet-entry-outcome--won {
  color: var(--success-color);
}

.bet-entry-outcome--lost {
  color: var(--danger-color);
}

.bet-entry-outcome--pushed {
  color: var(--secondary-text);
  font-weight: 600;
  font-size: 0.9rem;
}

.bet-entry-legs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bet-leg {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  column-gap: var(--space-3);
  row-gap: var(--space-2);
  align-items: center;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background-color: rgba(255, 255, 255, 0.03);
}

.bet-leg-avatar {
  grid-row: 1;
  grid-column: 1;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.bet-leg-info {
  grid-row: 1;
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bet-leg-name {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--primary-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bet-leg-subtitle {
  font-size: 0.75rem;
  color: var(--secondary-text);
}

.bet-leg-pick {
  grid-row: 1;
  grid-column: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.bet-leg-pick-value {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--primary-text);
}

.bet-leg-pick-stat {
  font-size: 0.7rem;
  color: var(--secondary-text);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.bet-leg-pick--pending .bet-leg-pick-value {
  color: var(--accent-purple);
}

.bet-leg-pick--win .bet-leg-pick-value {
  color: var(--success-color);
}

.bet-leg-pick--loss .bet-leg-pick-value {
  color: var(--danger-color);
}

.bet-leg-pick--push .bet-leg-pick-value {
  color: var(--secondary-text);
}

.bet-leg-progress-row {
  grid-row: 2;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.bet-leg-progress-track {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background-color: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.bet-leg-progress-fill {
  height: 100%;
  width: 100%;
  border-radius: var(--radius-pill);
}

.bet-leg-progress-fill--win {
  background-color: var(--success-color);
}

.bet-leg-progress-fill--loss {
  background-color: var(--danger-color);
}

.bet-leg-progress-fill--push {
  background-color: var(--secondary-text);
}

.bet-leg-progress-pill {
  flex-shrink: 0;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.75rem;
  text-align: center;
  border: 1.5px solid;
}

.bet-leg-progress-pill--win {
  color: var(--success-color);
  border-color: var(--success-color);
}

.bet-leg-progress-pill--loss {
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.bet-leg-progress-pill--push {
  color: var(--secondary-text);
  border-color: var(--secondary-text);
}

.bet-entry-footer {
  font-size: 0.75rem;
  color: var(--secondary-text);
}
```

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: Commit**

```bash
git add src/components/sub_components/BetEntryCard.astro src/styles/global.css
git commit -m "Add BetEntryCard component for the redesigned My Bets cards"
```

---

## Task 7: Wire `BetEntryCard` into `/my-bets`, end-to-end verification

**Files:**
- Modify: `src/pages/my-bets.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `BetEntryCard` (Task 6), `listBetsForUser` (already resolves avatars per Task 5).
- Produces: nothing — this is the last task, it makes the whole feature visible.

- [ ] **Step 1: Add the list container CSS**

Add this block at the end of `src/styles/global.css`:

```css

.bet-entry-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  text-align: left;
}
```

- [ ] **Step 2: Replace the flat card markup with `BetEntryCard`**

Replace the entire contents of `src/pages/my-bets.astro` with:

```astro
---
import Layout from "../layouts/Layout.astro";
import Header from "../components/sub_components/Header.astro";
import Beams from "../components/react/Beams";
import BetEntryCard from "../components/sub_components/BetEntryCard.astro";
import { listBetsForUser } from "../lib/bets";

if (!Astro.locals.user) {
  return Astro.redirect("/login");
}

const bets = await listBetsForUser(Astro.locals.user.id);
const liveBets = bets.filter((bet) => bet.status === "pending");
const pastBets = bets.filter((bet) => bet.status !== "pending");
---

<Layout>
  <script src="../scripts/myBets.js"></script>
  <div class="page-bg beams-page-bg">
    <Beams
      client:load
      beamWidth={2}
      beamHeight={15}
      beamNumber={12}
      lightColor="#7c5cfc"
      secondaryLightColor="#d4a72c"
      speed={2}
      noiseIntensity={1.75}
      scale={0.2}
      rotation={0}
      backgroundColor="#050506"
    />
  </div>
  <Header />
  <main class="container">
    <h2 class="title live-bets-title"><span class="live-dot" aria-hidden="true"></span>Live Bets</h2>
    <div class="bet-entry-list">
      {liveBets.map((bet) => <BetEntryCard bet={bet} />)}
      {liveBets.length === 0 && <p>No live bets right now.</p>}
    </div>

    <h2 class="title">Past Bets</h2>
    <div class="bet-entry-list">
      {pastBets.map((bet) => <BetEntryCard bet={bet} />)}
      {pastBets.length === 0 && <p>No settled bets yet.</p>}
    </div>

    <script type="application/json" id="past-bets-data" set:html={JSON.stringify(pastBets)} />
  </main>
</Layout>

<style>
  .title {
    text-align: left;
  }

  .live-bets-title {
    position: relative;
    letter-spacing: -0.02em;
    padding-bottom: var(--space-3);
    background: linear-gradient(135deg, var(--accent-purple), color-mix(in srgb, var(--accent-purple) 40%, white));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }

  .live-bets-title::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 56px;
    height: 3px;
    border-radius: var(--radius-pill);
    background-color: var(--accent-purple);
  }

  .live-bets-title .live-dot {
    background-color: var(--accent-purple);
    margin-right: var(--space-2);
  }
</style>
```

(Only the `<div class="grid">...</div>` blocks are replaced with `<div class="bet-entry-list">...<BetEntryCard bet={bet} />...</div>` — the `<Layout>`/`<Beams>`/`<Header>` wrapper, the two `<h2 class="title">` headings, the empty-state `<p>` fallbacks, the `#past-bets-data` script tag, and the `<style>` block are all unchanged from today.)

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: End-to-end manual verification in the browser**

With the dev server running and logged in as a regular user with at least one settled and one pending bet (place a few test bets and grade some via `/admin/props` if you don't already have a mix):

1. Open `/my-bets`. Confirm both sections render the new card layout — header (mode/count, stake @ multiplier, colored outcome) above a list of leg rows (photo, name, sport/team subtitle, pick/line/stat, progress bar), footer with a placed date.
2. **Pending bet:** confirm the header's outcome text reads `"Potential +N units"` in purple, and every leg still awaiting grading shows an empty/muted progress track with no trailing pill.
3. **Partially-graded parlay:** place a 2+ leg parlay, grade only one of its props via `/admin/props` (with a `finalValue`). Confirm that one leg's row updates to a full colored bar + numeric pill while the bet stays in Live Bets and its other leg(s) stay pending — and the header still reads "Potential +..." in purple, since the overall bet hasn't settled yet.
4. **Won bet graded with a `finalValue`:** grade the rest of that parlay's legs as wins. Confirm it moves to Past Bets, the header outcome reads `"+N units"` in green, and every leg shows a full green bar with its numeric `finalValue` in the trailing pill.
5. **Graded without a `finalValue`:** create and grade a prop without entering a final value, bet on it beforehand. Confirm the resulting leg still renders a full colored bar, with a ✓/✕/= glyph in the pill instead of a broken or empty one.
6. **Lost bet:** confirm a lost bet's header reads `"-N units"` in red, and its losing leg(s) render a full red bar.
7. **Pushed bet:** confirm a pushed bet's header reads `"Push · stake returned"` in gray, with no animated number, and its leg(s) render a full gray bar with a `=` glyph (or the `finalValue` if one was entered).
8. **Avatars:** confirm a leg linked to a registered user shows that user's real photo, and a leg on a free-text player shows its sprite fallback.
9. **Win celebration still fires once:** if you have a bet that just moved to "won" for the first time, confirm the confetti + toast still appears on page load, and does not repeat on a subsequent reload (this exercises `myBets.js`'s existing `localStorage`-backed celebration tracking, unaffected by this task's markup changes).
10. **Empty states:** temporarily check both empty-state messages still render correctly if you have a user account with no bets in one or both sections yet.
11. **Old-bet compatibility (if reachable):** if any bet in your database predates this feature (placed before Task 1 shipped), confirm it still renders without errors — sport-only subtitle (no `•` separator), sprite avatar, and (if settled) a glyph-only progress pill.
12. Resize to a narrow (~375px) viewport and confirm no card content overflows horizontally.

- [ ] **Step 5: Commit**

```bash
git add src/pages/my-bets.astro src/styles/global.css
git commit -m "Redesign My Bets to use the new BetEntryCard layout"
```
