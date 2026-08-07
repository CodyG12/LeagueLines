import type { APIRoute } from "astro";
import { setUserAvatar } from "../../../lib/users";
import { SPRITE_AVATARS } from "../../../lib/sprites";
import { uploadAvatar, InvalidAvatarError } from "../../../lib/avatarStorage";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) {
    return redirect("/login");
  }

  const form = await request.formData();
  const avatarFile = form.get("avatar");
  const avatarSprite = form.get("avatarSprite");

  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const avatarUrl = await uploadAvatar(avatarFile, locals.user.username);
      await setUserAvatar(locals.user.id, avatarUrl);
    } catch (err) {
      if (err instanceof InvalidAvatarError) {
        return redirect(`/account?error=${err.code === "invalid-type" ? "invalid-avatar-type" : "avatar-too-large"}`);
      }
      console.error("Avatar upload failed:", err);
      return redirect("/account?error=avatar-upload-failed");
    }
    return redirect("/account");
  }

  if (typeof avatarSprite === "string" && (SPRITE_AVATARS as readonly string[]).includes(avatarSprite)) {
    await setUserAvatar(locals.user.id, avatarSprite);
  }

  return redirect("/account");
};
