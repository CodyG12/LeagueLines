// Select all player prop containers
const playerPropContainers = document.querySelectorAll(".player-prop");

// Keep in sync with MAX_LEGS in src/lib/bets.ts.
const MAX_LEGS = 10;

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
      openModalBtn.classList.add("visible"); // Show with transition
    } else {
      openModalBtn.classList.remove("visible"); // Hide smoothly
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

// document.addEventListener("DOMContentLoaded", () => {
//   const playerPropContainers = document.querySelectorAll(".player-prop");

//   playerPropContainers.forEach((container) => {
//     const overBtn = container.querySelector(".over-btn");
//     const underBtn = container.querySelector(".under-btn");
//     const openModalBtn = document.getElementById("openModal");

//     if (!overBtn || !underBtn) return;

//     function toggleSelection(clickedBtn, otherBtn, color) {
//       const isSelected = clickedBtn.classList.contains("selected");
//       otherBtn.classList.remove("selected");
//       otherBtn.style.backgroundColor = "";

//       if (isSelected) {
//         clickedBtn.classList.remove("selected");
//         clickedBtn.style.backgroundColor = "";
//       } else {
//         clickedBtn.classList.add("selected");
//         clickedBtn.style.backgroundColor = color;
//       }
//       updateOpenButtonVisibility();
//     }

//     function updateOpenButtonVisibility() {
//       if (
//         document.querySelector(".over-btn.selected") ||
//         document.querySelector(".under-btn.selected")
//       ) {
//         openModalBtn.classList.add("visible");
//       } else {
//         openModalBtn.classList.remove("visible");
//       }
//     }

//     overBtn.addEventListener("click", () => {
//       toggleSelection(overBtn, underBtn, "blue");
//     });

//     underBtn.addEventListener("click", () => {
//       toggleSelection(underBtn, overBtn, "yellow");
//     });
//   });
// });
