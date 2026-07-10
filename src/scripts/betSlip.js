import { animateNumber } from "./animateCounter.js";

const openBtn = document.getElementById("openModal");
const modal = document.getElementById("modal");
const legsContainer = document.getElementById("bet-slip-legs");
const parlayStakeWrap = document.getElementById("parlay-stake-wrap");
const parlayStakeInput = document.getElementById("parlayStake");
const betModeLabel = document.getElementById("bet-mode-label");
const summaryEl = document.getElementById("bet-slip-summary");
const errorEl = document.getElementById("bet-slip-error");
const placeBetBtn = document.getElementById("placeBetBtn");
const betslipCountEl = document.getElementById("betslip-count");
const betslipPayoutEl = document.getElementById("betslip-payout");
const isLoggedIn = document.body.dataset.loggedIn === "true";

let lastPayoutShown = 0;

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
  openBtn?.classList.toggle("visible", Boolean(hasSelection));
  if (!hasSelection) {
    modal?.classList.remove("open");
  }
}

function currentMode() {
  return getSelectedPicks().length >= 2 ? "parlay" : "single";
}

function computePayout(picks) {
  const mode = currentMode();
  let payout = 0;

  if (mode === "parlay") {
    const stake = Number(parlayStakeInput?.value) || 0;
    payout = stake * 2 ** picks.length;
  } else {
    legsContainer?.querySelectorAll(".leg-stake").forEach((input) => {
      const stake = Number(input.value) || 0;
      payout += stake * 2;
    });
  }

  return payout;
}

function updateMiniBar() {
  if (!betslipCountEl || !betslipPayoutEl) return;
  const picks = getSelectedPicks();

  betslipCountEl.textContent = picks.length === 1 ? "1 Pick" : `${picks.length} Picks`;

  if (picks.length === 0) {
    betslipPayoutEl.textContent = "";
    lastPayoutShown = 0;
    return;
  }

  const payout = computePayout(picks);
  animateNumber(betslipPayoutEl, lastPayoutShown, payout, {
    duration: 400,
    prefix: "To win ",
    suffix: " units",
  });
  lastPayoutShown = payout;
}

function updateSummary() {
  const picks = getSelectedPicks();
  if (currentMode() === "parlay") {
    const stake = Number(parlayStakeInput.value) || 0;
    summaryEl.textContent = `Parlay stake: ${stake} units across ${picks.length} picks`;
  } else {
    let total = 0;
    legsContainer.querySelectorAll(".leg-stake").forEach((input) => {
      total += Number(input.value) || 0;
    });
    summaryEl.textContent = picks.length
      ? `Total stake: ${total} units for ${picks[0].prop.player}`
      : "";
  }
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

    if (mode === "single") {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.placeholder = "stake";
      input.className = "leg-stake";
      input.dataset.propId = prop.id;
      input.dataset.pick = pick;
      row.appendChild(input);
    }

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

  parlayStakeWrap.hidden = mode !== "parlay";
  updateSummary();
}

openBtn?.addEventListener("click", () => {
  errorEl.textContent = "";
  if (!isLoggedIn) {
    window.location.href = "/login";
    return;
  }
  renderLegs();
});

// Keep the mini bar + sheet contents live as picks are made anywhere on the page,
// not just when the sheet is opened.
document.addEventListener("click", (event) => {
  if (event.target.closest(".over-btn, .under-btn")) {
    renderLegs();
  }
});

legsContainer?.addEventListener("input", updateSummary);
parlayStakeInput?.addEventListener("input", updateSummary);

placeBetBtn?.addEventListener("click", async () => {
  errorEl.textContent = "";
  const picks = getSelectedPicks();

  if (picks.length === 0) {
    errorEl.textContent = "Select at least one pick first.";
    return;
  }

  const mode = currentMode();
  let body;

  if (mode === "parlay") {
    body = {
      mode: "parlay",
      stake: Number(parlayStakeInput.value),
      picks: picks.map(({ prop, pick }) => ({ propId: prop.id, pick })),
    };
  } else {
    const legStakeInputs = legsContainer.querySelectorAll(".leg-stake");
    body = {
      mode: "single",
      picks: Array.from(legStakeInputs).map((input) => ({
        propId: input.dataset.propId,
        pick: input.dataset.pick,
        stake: Number(input.value),
      })),
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
