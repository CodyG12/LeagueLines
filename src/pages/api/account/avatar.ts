import type { APIRoute } from "astro";
import { setUserAvatar } from "../../../lib/users";
import { SPRITE_AVATARS } from "../../../lib/sprites";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    return redirect("/login");
  }

  const form = await request.formData();
  const avatarSprite = form.get("avatarSprite");

  if (typeof avatarSprite !== "string" || !(SPRITE_AVATARS as readonly string[]).includes(avatarSprite)) {
    return redirect("/account");
  }

  await setUserAvatar(locals.user.id, avatarSprite);
  return redirect("/account");
};
