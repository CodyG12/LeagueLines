// iOS Safari has no beforeinstallprompt — this shows a one-time
// instructional banner instead, only for iOS's actual Safari (not Chrome/
// Firefox/Edge on iOS, which all run on WebKit too but can't install to
// the home screen the same way and shouldn't see "Add to Home Screen").
const DISMISSED_KEY = "leagueLines.iosInstallBannerDismissed";

function isIos(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "MacIntel" in the UA string but is touch-capable,
  // unlike an actual Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isSafari(): boolean {
  const ua = navigator.userAgent;
  // Chrome/Firefox/Edge/Opera on iOS all identify themselves with their
  // own token even though they're WebKit under the hood — only a UA with
  // none of those tokens (but still "Safari") is actual Safari.
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  return /Safari/.test(ua) && !otherIosBrowser;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function init() {
  const banner = document.getElementById("ios-install-banner");
  const dismissBtn = document.getElementById("ios-install-dismiss");
  if (!banner || !dismissBtn) return;

  const alreadyDismissed = localStorage.getItem(DISMISSED_KEY) === "true";

  if (isStandalone() || alreadyDismissed || !isIos() || !isSafari()) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;

  dismissBtn.addEventListener("click", () => {
    banner.hidden = true;
    localStorage.setItem(DISMISSED_KEY, "true");
  });
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);

// A .ts file with no top-level import/export is treated as a global script
// by TypeScript's module detection, not an isolated module — without this,
// `init`/`isStandalone` collide with installPrompt.ts's same-named
// top-level functions under `astro check`.
export {};
