function init() {
  const form = document.getElementById("signupForm");
  const overlay = document.getElementById("signupLoadingOverlay");
  if (!form || !overlay) return;

  // The form does a real POST + full-page reload (data-astro-reload), not a
  // fetch — this just shows the overlay for the moment between submit and
  // the browser navigating to the result page. The native "submit" event
  // only fires once the browser's own required/pattern validation passes,
  // so invalid submissions correctly never show it.
  form.addEventListener("submit", () => {
    overlay.hidden = false;
  });
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
