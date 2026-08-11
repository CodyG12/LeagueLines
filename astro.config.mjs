// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import AstroPWA from "@vite-pwa/astro";

// @vite-pwa/astro declares peer support only up to Astro ^5, but its actual
// build-time orchestration (hooking Astro's `astro:build:done`, which fires
// once after both of Astro's SSR builds — client assets, then server
// entry — complete) is exactly what correctly triggers service-worker
// generation for an SSR app; a bare `vite-plugin-pwa` instance added via
// `vite.plugins` runs during each of Astro's internal Vite builds
// separately and silently produces no sw.js at all (confirmed by building
// both ways and diffing the output). What IS broken under Astro 7 is this
// integration's auto-injection of <link rel="manifest"> and the SW
// registration script into the page <head> — confirmed by building and
// inspecting rendered output, where neither tag ever appeared regardless
// of devOptions. So: use this integration for what it does correctly (SW
// build), and wire the manifest link + registration manually (see
// src/layouts/Layout.astro and src/scripts/registerSW.ts) to cover what it
// doesn't.
export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [
    react(),
    AstroPWA({
      registerType: "autoUpdate",
      // Registered ourselves via the `virtual:pwa-register` module
      // (src/scripts/registerSW.ts) instead — this integration's own
      // registration-script injection doesn't fire under Astro 7 (see
      // note above), and there's no single index.html for it to inject
      // into in an Astro SSR app regardless.
      injectRegister: false,
      // The generated service worker is disabled in `astro dev` by
      // default (dev-mode assets change too fast for SW caching to make
      // sense) — validate against a real production build instead (the
      // @astrojs/vercel adapter doesn't support `astro preview`; run
      // `vercel dev` or deploy to a preview URL).
      devOptions: { enabled: false },
      manifest: {
        name: "LeagueLines",
        short_name: "LeagueLines",
        description:
          "Pick overs and unders on real player stats, stack them into parlays, and see who actually knows sports. No real money — just units and bragging rights.",
        start_url: "/",
        display: "standalone",
        background_color: "#050506",
        theme_color: "#050506",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // This app is server-rendered (output: "server"), not static — most
        // routes have no static HTML file to precache. `globPatterns` (left
        // at its default) precaches the static build output (JS/CSS/fonts/
        // icons); page HTML is handled below via runtime caching instead,
        // since it's rendered per-request.
        runtimeCaching: [
          // Never let the service worker touch API calls — these handle
          // auth, bet placement, and unit balances. Caching them risks
          // serving stale or wrong account state.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          // Page navigations: try the network first so online users always
          // see current data; fall back to the last-cached copy of a
          // previously-visited page when offline. Excludes /api (handled
          // above) and /admin (an internal, password-gated tool — no need
          // to make it available offline).
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/admin"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          // Google Fonts (Geist, Erica One) + Fontshare (General Sans,
          // Instrument Sans) — Workbox's standard font-caching recipe.
          {
            urlPattern: ({ url }) =>
              ["fonts.googleapis.com", "fonts.gstatic.com", "api.fontshare.com", "cdn.fontshare.com"].includes(
                url.hostname,
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images: sprite/mascot avatars (same-origin) and uploaded profile
          // photos (Vercel Blob, cross-origin) — matched by request
          // destination rather than hostname so both are covered.
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
