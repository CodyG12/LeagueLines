function init() {
  const openBtn = document.getElementById("openModal");
  const closeBtn = document.getElementById("closeModal");
  const modal = document.getElementById("modal");

  if (!openBtn || !closeBtn || !modal) return;

  openBtn.addEventListener("click", () => {
    modal.classList.add("open");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  window.showOrHide = function () {
    openBtn.classList.add("visible");
  };
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
