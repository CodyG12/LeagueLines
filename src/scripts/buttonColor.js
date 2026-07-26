// Keep in sync with MAX_LEGS in src/lib/bets.ts.
const MAX_LEGS = 10;

function init() {
  const playerPropContainers = document.querySelectorAll(".player-prop");

  // Loop through each player prop container to handle toggling independently
  playerPropContainers.forEach((container) => {
    const overBtn = container.querySelector(".over-btn");
    const underBtn = container.querySelector(".under-btn");
    const openModalBtn = document.getElementById("openModal");

    if (!overBtn || !underBtn) return;

    function toggleSelection(clickedBtn, otherBtn) {
      const isSelected = clickedBtn.classList.contains("selected");
      const isSwap = !isSelected && otherBtn.classList.contains("selected");

      if (!isSelected && !isSwap) {
        const selectedCount = document.querySelectorAll(
          ".over-btn.selected, .under-btn.selected",
        ).length;
        if (selectedCount >= MAX_LEGS) {
          alert(`You can only bet on up to ${MAX_LEGS} props at once.`);
          return;
        }
      }

      // Deselect the other button within the same container
      otherBtn.classList.remove("selected");

      if (isSelected) {
        // If already selected, deselect it
        clickedBtn.classList.remove("selected");
      } else {
        // Otherwise, select it
        clickedBtn.classList.add("selected");
      }

      updateOpenButtonVisibility();
    }

    function updateOpenButtonVisibility() {
      if (
        document.querySelector(".over-btn.selected") ||
        document.querySelector(".under-btn.selected")
      ) {
        openModalBtn?.classList.add("visible"); // Show with transition
      } else {
        openModalBtn?.classList.remove("visible"); // Hide smoothly
      }
    }

    // Add event listeners
    overBtn.addEventListener("click", () => {
      toggleSelection(overBtn, underBtn);
    });

    underBtn.addEventListener("click", () => {
      toggleSelection(underBtn, overBtn);
    });
  });
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
