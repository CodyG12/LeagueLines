import type { APIRoute } from "astro";
import { createUser } from "../../../lib/users";
import { USER_COOKIE_NAME, createUserSessionToken } from "../../../lib/userAuth";
import { uploadAvatar, InvalidAvatarError } from "../../../lib/avatarStorage";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const firstName = form.get("firstName");
  const lastName = form.get("lastName");
  const username = form.get("username");
  const password = form.get("password");
  const avatar = form.get("avatar");

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0
  ) {
    return redirect("/signup?error=missing-fields");
  }

  if (!USERNAME_PATTERN.test(username)) {
    return redirect("/signup?error=invalid-username");
  }

  if (password.length < 8) {
    return redirect("/signup?error=short-password");
  }

  let avatarUrl: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    try {
      avatarUrl = await uploadAvatar(avatar, username.toLowerCase());
    } catch (err) {
      if (err instanceof InvalidAvatarError) {
        return redirect(`/signup?error=${err.code === "invalid-type" ? "invalid-avatar-type" : "avatar-too-large"}`);
      }
      throw err;
    }
  }

  const user = await createUser(firstName.trim(), lastName.trim(), username, password, avatarUrl);
  if (user === "duplicate") {
    return redirect("/signup?error=duplicate");
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
