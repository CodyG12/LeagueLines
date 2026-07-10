import type { APIRoute } from "astro";
import { ADMIN_COOKIE_NAME, createSessionToken, verifyPassword } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = form.get("password");

  if (typeof password !== "string" || !verifyPassword(password)) {
    return redirect("/admin/login?error=1");
  }

  cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return redirect("/admin/props");
};
