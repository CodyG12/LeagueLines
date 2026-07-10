import type { APIRoute } from "astro";
import clientPromise from "../../lib/mongodb";

export const GET: APIRoute = async () => {
  const client = await clientPromise;
  const result = await client.db().command({ ping: 1 });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
