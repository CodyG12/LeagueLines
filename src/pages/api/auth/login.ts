import type { APIRoute } from "astro";
import { verifyUserCredentials } from "../../../lib/users";
import { USER_COOKIE_NAME, createUserSessionToken } from "../../../lib/userAuth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return redirect("/login?error=1");
  }

  const user = await verifyUserCredentials(username, password);
  if (!user) {
    return redirect("/login?error=1");
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
