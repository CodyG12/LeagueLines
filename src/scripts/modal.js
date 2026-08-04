function init() {
  const openBtn = document.getElementById("openModal");
  const closeBtn = document.getElementById("closeModal");
  const modal = document.getElementById("modal");
  const modalInner = modal ? modal.querySelector(".modal-inner") : null;
  const handle = modalInner ? modalInner.querySelector(".bet-slip-handle") : null;

  if (!openBtn || !closeBtn || !modal) return;

  openBtn.addEventListener("click", () => {
    modal.classList.add("open");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  if (modalInner && handle) {
    let startY = 0;
    let dragDelta = 0;
    let dragging = false;

    handle.addEventListener(
      "touchstart",
      (event) => {
        startY = event.touches[0].clientY;
        dragDelta = 0;
        dragging = true;
        modalInner.classList.add("dragging");
      },
      { passive: true },
    );

    handle.addEventListener(
      "touchmove",
      (event) => {
        if (!dragging) return;
        dragDelta = Math.max(0, event.touches[0].clientY - startY);
        modalInner.style.transform = `translateY(${dragDelta}px)`;
      },
      { passive: true },
    );

    handle.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;

      const closeThreshold = Math.min(120, modalInner.getBoundingClientRect().height * 0.25);
      const shouldClose = dragDelta > closeThreshold;

      modalInner.classList.remove("dragging");
      modalInner.style.transform = "";
      modal.classList.toggle("open", !shouldClose);
    });
  }

  window.showOrHide = function () {
    openBtn.classList.add("visible");
  };
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
