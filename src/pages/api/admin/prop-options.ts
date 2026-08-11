import type { APIRoute } from "astro";
import { addOption, deleteOption, type OptionType } from "../../../lib/propOptions";

const VALID_TYPES: OptionType[] = ["sport", "player", "stat"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseOptionInput(
  body: unknown,
  sportRequiredMessage: string,
): { type: OptionType; value: string; sport: string | null } | string {
  if (typeof body !== "object" || body === null) return "Request body must be an object";

  const { type, value, sport } = body as Record<string, unknown>;
  if (typeof type !== "string" || !VALID_TYPES.includes(type as OptionType)) {
    return "type must be one of sport, player, stat";
  }
  if (typeof value !== "string" || value.trim() === "") {
    return "value must be a non-empty string";
  }

  let sportValue: string | null = null;
  if (type === "stat") {
    if (typeof sport !== "string" || sport.trim() === "") {
      return sportRequiredMessage;
    }
    sportValue = sport.trim();
  }

  return { type: type as OptionType, value: value.trim(), sport: sportValue };
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseOptionInput(body, "sport is required when adding a stat");
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  await addOption(parsed.type, parsed.value, parsed.sport);
  return jsonResponse({ success: true }, 201);
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parsed = parseOptionInput(body, "sport is required when deleting a stat");
  if (typeof parsed === "string") return jsonResponse({ error: parsed }, 400);

  const deleted = await deleteOption(parsed.type, parsed.value, parsed.sport);
  if (!deleted) return jsonResponse({ error: "Option not found" }, 404);
  return jsonResponse({ success: true }, 200);
};
