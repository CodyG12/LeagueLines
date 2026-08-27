import type { APIRoute } from "astro";
import { ObjectId } from "mongodb";
import {
  deleteProp,
  getPropById,
  updateProp,
  type PropResult,
  type UpdatePropInput,
} from "../../../../lib/props";
import { settleBetsForProp, voidBetsForProp } from "../../../../lib/bets";
import { getUserById } from "../../../../lib/users";
import { checkAndAwardBadges } from "../../../../lib/badges";

const VALID_RESULTS: PropResult[] = ["over", "under", "push"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseUpdateInput(body: unknown): UpdatePropInput | string {
  if (typeof body !== "object" || body === null) return "Request body must be an object";
  const b = body as Record<string, unknown>;
  const input: UpdatePropInput = {};

  if (b.sport !== undefined) {
    if (typeof b.sport !== "string" || b.sport.trim() === "") return "sport must be a non-empty string";
    input.sport = b.sport;
  }
  if (b.player !== undefined) {
    if (typeof b.player !== "string" || b.player.trim() === "") return "player must be a non-empty string";
    input.player = b.player;
  }
  if (b.playerUserId !== undefined) {
    if (b.playerUserId !== null) {
      if (typeof b.playerUserId !== "string" || !ObjectId.isValid(b.playerUserId)) {
        return "playerUserId must be a valid id or null";
      }
    }
    input.playerUserId = b.playerUserId as string | null;
  }
  if (b.stat !== undefined) {
    if (typeof b.stat !== "string" || b.stat.trim() === "") return "stat must be a non-empty string";
    input.stat = b.stat;
  }
  if (b.team !== undefined) {
    if (b.team !== null && typeof b.team !== "string") return "team must be a string or null";
    input.team = b.team as string | null;
  }
  if (b.line !== undefined) {
    if (typeof b.line !== "number" || !Number.isFinite(b.line)) return "line must be a number";
    input.line = b.line;
  }
  if (b.startTime !== undefined) {
    const startTime = new Date(String(b.startTime));
    if (Number.isNaN(startTime.getTime())) return "startTime must be a valid date";
    input.startTime = startTime;
  }
  if (b.status !== undefined) {
    if (b.status !== "scheduled" && b.status !== "live" && b.status !== "closed") {
      return "status must be one of scheduled, live, closed";
    }
    input.status = b.status;
  }
  if (b.result !== undefined) {
    if (b.result !== null && !VALID_RESULTS.includes(b.result as PropResult)) {
      return "result must be one of over, under, push, or null";
    }
    input.result = b.result as PropResult;
  }

  if (input.status === "closed" && !input.result) {
    return "result is required when closing a prop";
  }

  return input;
}

function parseFinalValue(body: unknown): number | null | string {
  const raw = (body as Record<string, unknown> | null)?.finalValue;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return "finalValue must be a number or null";
  return raw;
}

export const GET: APIRoute = async ({ params }) => {
  const prop = await getPropById(params.id!);
  if (!prop) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ prop }, 200);
};

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

export const DELETE: APIRoute = async ({ params }) => {
  await voidBetsForProp(params.id!);
  const success = await deleteProp(params.id!);
  if (!success) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ success: true }, 200);
};
