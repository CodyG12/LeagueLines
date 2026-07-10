// To open modal
const openBtn = document.getElementById("openModal");
const closeBtn = document.getElementById("closeModal");
const modal = document.getElementById("modal");

openBtn.addEventListener("click", () => {
  modal.classList.add("open");
});

closeBtn.addEventListener("click", () => {
  modal.classList.remove("open");
});

// To hide and show modal
const divContainer = document.querySelector("#openModal");

if (divContainer) {
  window.showOrHide = function () {
    divContainer.classList.add("visible");
  };
} else {
  console.error("Element with ID 'openModal' not found.");
}

// document.addEventListener("DOMContentLoaded", () => {
//   const openBtn = document.getElementById("openModal");
//   const closeBtn = document.getElementById("closeModal");
//   const modal = document.getElementById("modal");

//   if (openBtn && closeBtn && modal) {
//     openBtn.addEventListener("click", () => {
//       modal.classList.add("open");
//     });

//     closeBtn.addEventListener("click", () => {
//       modal.classList.remove("open");
//     });
//   } else {
//     console.error("Modal elements not found.");
//   }

//   const divContainer = document.querySelector("#openModal");
//   if (divContainer) {
//     window.showOrHide = function () {
//       divContainer.classList.add("visible");
//     };
//   } else {
//     console.error("Element with ID 'openModal' not found.");
//   }
// });
