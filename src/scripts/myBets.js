import { animateNumber } from "./animateCounter.js";
import { fireConfetti } from "./confetti.js";

const STORAGE_KEY = "leagueLines.celebratedBets";

function getCelebrated() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveCelebrated(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

document.querySelectorAll("[data-animate-number]").forEach((el) => {
  const target = Number(el.dataset.animateNumber);
  if (Number.isFinite(target)) {
    animateNumber(el, 0, target, { duration: 700, decimals: Number.isInteger(target) ? 0 : 1 });
  }
});

const betsDataEl = document.getElementById("past-bets-data");
if (betsDataEl) {
  try {
    const bets = JSON.parse(betsDataEl.textContent || "[]");
    const celebrated = getCelebrated();
    const newlyWon = bets.filter((b) => b.status === "won" && !celebrated.has(b.id));

    if (newlyWon.length > 0) {
      fireConfetti();
      showToast(newlyWon.length === 1 ? "You won a bet!" : `You won ${newlyWon.length} bets!`);
      newlyWon.forEach((b) => celebrated.add(b.id));
      saveCelebrated(celebrated);
    }
  } catch {
    // malformed data — skip celebration silently
  }
}
