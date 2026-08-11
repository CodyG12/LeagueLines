// Chrome/Edge/Android fire this instead of showing their own install UI,
// as long as the page calls preventDefault() — we stash the event and
// trigger it later from our own "Install" button instead.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersAttached = false;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function showBanner() {
  document.getElementById("pwa-install-banner")?.removeAttribute("hidden");
}

function hideBanner() {
  document.getElementById("pwa-install-banner")?.setAttribute("hidden", "");
}

function init() {
  const banner = document.getElementById("pwa-install-banner");
  const installBtn = document.getElementById("pwa-install-btn");
  const dismissBtn = document.getElementById("pwa-install-dismiss");
  if (!banner || !installBtn || !dismissBtn) return;

  if (isStandalone()) {
    hideBanner();
    return;
  }

  // Re-sync visibility on the freshly-mounted DOM: if the prompt was
  // already captured on an earlier page before the user navigated here,
  // the banner should still show.
  banner.hidden = !deferredPrompt;

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    hideBanner();
    await deferredPrompt.prompt();
    deferredPrompt = null;
  });

  dismissBtn.addEventListener("click", hideBanner);

  // `window` persists across Astro View Transitions navigations (only the
  // DOM content is swapped), so these are attached once, not re-attached
  // on every astro:page-load like the DOM queries/listeners above.
  if (!listenersAttached) {
    listenersAttached = true;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      showBanner();
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      hideBanner();
    });
  }
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);

// A .ts file with no top-level import/export is treated as a global script
// by TypeScript's module detection, not an isolated module — without this,
// `init`/`isStandalone` collide with iosInstallBanner.ts's same-named
// top-level functions under `astro check`.
export {};
