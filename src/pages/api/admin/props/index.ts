import type { APIRoute } from "astro";
import { createProp, listAllProps, type CreatePropInput } from "../../../../lib/props";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseCreateInput(body: unknown): CreatePropInput | string {
  if (typeof body !== "object" || body === null) return "Request body must be an object";
  const b = body as Record<string, unknown>;

  if (typeof b.sport !== "string" || b.sport.trim() === "") return "sport is required";
  if (typeof b.player !== "string" || b.player.trim() === "") return "player is required";
  if (typeof b.stat !== "string" || b.stat.trim() === "") return "stat is required";
  if (typeof b.line !== "number" || !Number.isFinite(b.line)) return "line must be a number";
  if (b.team !== undefined && b.team !== null && typeof b.team !== "string") {
    return "team must be a string or null";
  }

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

export const GET: APIRoute = async () => {
  const props = await listAllProps();
  return jsonResponse({ props }, 200);
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseCreateInput(body);
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const prop = await createProp(parsed);
  return jsonResponse({ prop }, 201);
};
