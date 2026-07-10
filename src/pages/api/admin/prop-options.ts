import type { APIRoute } from "astro";
import { addOption, type OptionType } from "../../../lib/propOptions";

const VALID_TYPES: OptionType[] = ["sport", "player", "stat"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "Request body must be an object" }, 400);
  }

  const { type, value } = body as Record<string, unknown>;
  if (typeof type !== "string" || !VALID_TYPES.includes(type as OptionType)) {
    return jsonResponse({ error: "type must be one of sport, player, stat" }, 400);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return jsonResponse({ error: "value must be a non-empty string" }, 400);
  }

  await addOption(type as OptionType, value.trim());
  return jsonResponse({ success: true }, 201);
};
