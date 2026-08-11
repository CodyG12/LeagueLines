import { registerSW } from "virtual:pwa-register";

// `registerType: "autoUpdate"` (astro.config.mjs) already configures the
// generated service worker to skip-waiting and claim clients on its own —
// `immediate: true` here just registers it as soon as this script runs,
// with no "update available" prompt to wire up.
registerSW({ immediate: true });
