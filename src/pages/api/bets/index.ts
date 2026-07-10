import type { APIRoute } from "astro";
import { listBetsForUser, placeBets, type BetMode, type PickInput } from "../../../lib/bets";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parsePlaceBetsInput(
  body: unknown,
): { mode: BetMode; picks: PickInput[]; parlayStake?: number } | string {
  if (typeof body !== "object" || body === null) return "Request body must be an object";
  const b = body as Record<string, unknown>;

  if (b.mode !== "single" && b.mode !== "parlay") return "mode must be 'single' or 'parlay'";
  if (!Array.isArray(b.picks) || b.picks.length === 0) return "picks must be a non-empty array";

  const picks: PickInput[] = [];
  for (const raw of b.picks) {
    if (typeof raw !== "object" || raw === null) return "Each pick must be an object";
    const p = raw as Record<string, unknown>;
    if (typeof p.propId !== "string" || p.propId.trim() === "") return "Each pick needs a propId";
    if (p.pick !== "over" && p.pick !== "under") return "Each pick's pick must be 'over' or 'under'";

    const pick: PickInput = { propId: p.propId, pick: p.pick };
    if (b.mode === "single") {
      if (typeof p.stake !== "number" || !Number.isFinite(p.stake) || p.stake <= 0) {
        return "Each pick must have a positive stake";
      }
      pick.stake = p.stake;
    }
    picks.push(pick);
  }

  if (b.mode === "parlay") {
    if (typeof b.stake !== "number" || !Number.isFinite(b.stake) || b.stake <= 0) {
      return "stake must be a positive number";
    }
    return { mode: "parlay", picks, parlayStake: b.stake };
  }

  return { mode: "single", picks };
}

export const GET: APIRoute = async ({ locals }) => {
  const bets = await listBetsForUser(locals.user!.id);
  return jsonResponse({ bets }, 200);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const parsed = parsePlaceBetsInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const result = await placeBets(locals.user!.id, parsed.mode, parsed.picks, parsed.parlayStake);
  if ("error" in result) return jsonResponse({ error: result.error }, 400);

  return jsonResponse({ bets: result.bets }, 201);
};
