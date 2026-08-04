import { animateNumber } from "./animateCounter.js";

// Keep in sync with MAX_LEGS / parlayMultiplier in src/lib/bets.ts.
const MAX_LEGS = 10;
const LEG_ODDS = 21 / 11;

function parlayMultiplier(legCount) {
  const n = Math.min(Math.max(legCount, 0), MAX_LEGS);
  return Math.round(LEG_ODDS ** n * 2) / 2;
}

let lastMultiplierShown = 0;

// The delegated click listener below targets document, which persists across
// Astro View Transitions navigations (unlike the elements below it, which get
// torn down and recreated on every page swap) -- track it so re-running init()
// on each navigation replaces it instead of stacking duplicate listeners.
let delegatedClickHandler = null;

function init() {
  const openBtn = document.getElementById("openModal");
  const modal = document.getElementById("modal");
  const legsContainer = document.getElementById("bet-slip-legs");
  const betSlipFooter = document.getElementById("bet-slip-footer");
  const stakeInput = document.getElementById("stakeInput");
  const multiplierEl = document.getElementById("bet-slip-multiplier");
  const payoutLineEl = document.getElementById("bet-slip-payout-line");
  const betModeLabel = document.getElementById("bet-mode-label");
  const errorEl = document.getElementById("bet-slip-error");
  const placeBetBtn = document.getElementById("placeBetBtn");
  const betslipCountEl = document.getElementById("betslip-count");
  const betslipPayoutEl = document.getElementById("betslip-payout");
  const isLoggedIn = document.body.dataset.loggedIn === "true";

  if (!openBtn || !modal || !legsContainer) return;

  function getSelectedPicks() {
    const picks = [];
    document.querySelectorAll(".over-btn.selected, .under-btn.selected").forEach((btn) => {
      const prop = JSON.parse(btn.dataset.prop);
      const pick = btn.classList.contains("over-btn") ? "over" : "under";
      picks.push({ prop, pick });
    });
    return picks;
  }

  function deselectPick(propId, pick) {
    const btnClass = pick === "over" ? ".over-btn" : ".under-btn";
    const btn = Array.from(document.querySelectorAll(`${btnClass}.selected`)).find((el) => {
      try {
        return JSON.parse(el.dataset.prop).id === propId;
      } catch {
        return false;
      }
    });
    if (btn) btn.classList.remove("selected");
  }

  function syncOpenButtonVisibility() {
    const hasSelection = document.querySelector(".over-btn.selected, .under-btn.selected");
    openBtn.classList.toggle("visible", Boolean(hasSelection));
    if (!hasSelection) {
      modal.classList.remove("open");
    }
  }

  function currentMode() {
    return getSelectedPicks().length >= 2 ? "parlay" : "single";
  }

  function updateMiniBar() {
    if (!betslipCountEl || !betslipPayoutEl) return;
    const picks = getSelectedPicks();

    betslipCountEl.textContent = picks.length === 1 ? "1 Pick" : `${picks.length} Picks`;

    if (picks.length === 0) {
      betslipPayoutEl.textContent = "";
      lastMultiplierShown = 0;
      return;
    }

    const multiplier = parlayMultiplier(picks.length);
    animateNumber(betslipPayoutEl, lastMultiplierShown, multiplier, {
      duration: 400,
      suffix: "x",
      decimals: 1,
    });
    lastMultiplierShown = multiplier;
  }

  function updateSummary() {
    const picks = getSelectedPicks();

    if (picks.length === 0) {
      updateMiniBar();
      return;
    }

    const multiplier = parlayMultiplier(picks.length);
    const stake = Number(stakeInput.value) || 0;
    const potentialWinnings = Math.round(stake * multiplier * 100) / 100;

    multiplierEl.textContent = `${multiplier.toFixed(1)}x`;
    payoutLineEl.textContent = `${stake} units pays ${potentialWinnings} units`;
    updateMiniBar();
  }

  function renderLegs() {
    const picks = getSelectedPicks();
    const mode = currentMode();

    legsContainer.innerHTML = "";
    picks.forEach(({ prop, pick }) => {
      const row = document.createElement("div");
      row.className = "bet-slip-leg";

      const label = document.createElement("span");
      label.textContent = `${prop.player} — ${pick} ${prop.line} ${prop.stat}`;
      row.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "leg-remove-btn";
      removeBtn.setAttribute("aria-label", `Remove ${prop.player} pick`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        deselectPick(prop.id, pick);
        syncOpenButtonVisibility();
        renderLegs();
      });
      row.appendChild(removeBtn);

      legsContainer.appendChild(row);
    });

    if (betModeLabel) {
      betModeLabel.textContent =
        mode === "parlay" ? `Parlay — ${picks.length} picks` : "Individual bet";
    }

    betSlipFooter.hidden = picks.length === 0;
    updateSummary();
  }

  openBtn.addEventListener("click", () => {
    errorEl.textContent = "";
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    renderLegs();
  });

  stakeInput?.addEventListener("input", updateSummary);

  document.querySelectorAll(".stake-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const add = Number(chip.dataset.add) || 0;
      const current = Number(stakeInput.value) || 0;
      stakeInput.value = String(current + add);
      updateSummary();
    });
  });

  placeBetBtn?.addEventListener("click", async () => {
    errorEl.textContent = "";
    const picks = getSelectedPicks();

    if (picks.length === 0) {
      errorEl.textContent = "Select at least one pick first.";
      return;
    }

    const mode = currentMode();
    const stake = Number(stakeInput.value);
    let body;

    if (mode === "parlay") {
      body = {
        mode: "parlay",
        stake,
        picks: picks.map(({ prop, pick }) => ({ propId: prop.id, pick })),
      };
    } else {
      body = {
        mode: "single",
        picks: picks.map(({ prop, pick }) => ({ propId: prop.id, pick, stake })),
      };
    }

    const response = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      errorEl.textContent = data.error || "Something went wrong.";
      return;
    }

    window.location.href = "/my-bets";
  });

  // Keep the mini bar + sheet contents live as picks are made anywhere on the page,
  // not just when the sheet is opened.
  if (delegatedClickHandler) {
    document.removeEventListener("click", delegatedClickHandler);
  }
  delegatedClickHandler = (event) => {
    if (event.target.closest(".over-btn, .under-btn")) {
      renderLegs();
    }
  };
  document.addEventListener("click", delegatedClickHandler);
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
