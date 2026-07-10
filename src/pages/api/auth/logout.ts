import type { APIRoute } from "astro";
import { USER_COOKIE_NAME } from "../../../lib/userAuth";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(USER_COOKIE_NAME, { path: "/" });
  return redirect("/");
};
