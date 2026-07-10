import { defineMiddleware } from "astro:middleware";
import { ADMIN_COOKIE_NAME, verifySessionToken as verifyAdminSessionToken } from "./lib/adminAuth";
import { USER_COOKIE_NAME, verifySessionToken as verifyUserSessionToken } from "./lib/userAuth";
import { getUserById } from "./lib/users";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const userToken = context.cookies.get(USER_COOKIE_NAME)?.value;
  const userId = verifyUserSessionToken(userToken);
  context.locals.user = userId ? await getUserById(userId) : null;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  const isBetsApi = pathname.startsWith("/api/bets");

  if (isAdminPage || isAdminApi) {
    const token = context.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/admin/login");
    }
  }

  if (isBetsApi && !context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return next();
});
