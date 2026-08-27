const form = document.getElementById("prop-form");
const idField = document.getElementById("prop-id");
const formTitle = document.getElementById("prop-form-title");
const submitBtn = document.getElementById("prop-form-submit");
const cancelBtn = document.getElementById("prop-form-cancel");
const errorBox = document.getElementById("form-error");
const statSelect = document.getElementById("stat");

const ADD_NEW_VALUE = "__add_new__";

// Stats are scoped per sport (see listStatOptionsBySport in
// src/lib/propOptions.ts) — keyed by sport name, e.g. { NBA: ["Assists", ...] }.
let statOptionsBySport = {};
try {
  statOptionsBySport = JSON.parse(statSelect?.dataset.statOptions || "{}");
} catch {
  statOptionsBySport = {};
}

// Rebuilds the Stat <select>'s options to match the given sport, keeping the
// placeholder and "+ Add New..." entries in place. Called whenever the
// selected sport changes (organically or via a newly-added sport) and when
// populating the form for editing an existing prop.
function populateStatOptions(sport) {
  if (!statSelect) return;

  const addNewOption = statSelect.querySelector(`option[value="${ADD_NEW_VALUE}"]`);
  Array.from(statSelect.options).forEach((opt) => {
    if (opt.value !== "" && opt.value !== ADD_NEW_VALUE) opt.remove();
  });

  (statOptionsBySport[sport] || []).forEach((stat) => {
    const option = document.createElement("option");
    option.value = stat;
    option.textContent = stat;
    statSelect.insertBefore(option, addNewOption);
  });

  statSelect.value = "";
}

const OPTION_FIELDS = [
  { id: "sport", type: "sport", label: "sport" },
  { id: "player", type: "player", label: "player" },
];

OPTION_FIELDS.forEach(({ id, type, label }) => {
  const select = document.getElementById(id);
  if (!select) return;

  let previousValue = select.value;

  select.addEventListener("change", async () => {
    if (select.value === ADD_NEW_VALUE) {
      const newValue = prompt(`Enter a new ${label}:`)?.trim();
      if (!newValue) {
        select.value = previousValue;
        return;
      }

      const existing = Array.from(select.options).find((opt) => opt.value === newValue);
      if (!existing) {
        const option = document.createElement("option");
        option.value = newValue;
        option.textContent = newValue;
        select.insertBefore(option, select.querySelector(`option[value="${ADD_NEW_VALUE}"]`));
      }
      select.value = newValue;

      await fetch("/api/admin/prop-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: newValue }),
      });
    }

    previousValue = select.value;

    if (id === "sport") {
      populateStatOptions(select.value);
    }
  });
});

if (statSelect) {
  let previousStatValue = statSelect.value;

  statSelect.addEventListener("change", async () => {
    if (statSelect.value !== ADD_NEW_VALUE) {
      previousStatValue = statSelect.value;
      return;
    }

    const sportSelect = document.getElementById("sport");
    const currentSport = sportSelect?.value;
    if (!currentSport || currentSport === ADD_NEW_VALUE) {
      alert("Select a sport first — stats are specific to a sport.");
      statSelect.value = previousStatValue;
      return;
    }

    const newValue = prompt("Enter a new stat:")?.trim();
    if (!newValue) {
      statSelect.value = previousStatValue;
      return;
    }

    const existing = Array.from(statSelect.options).find((opt) => opt.value === newValue);
    if (!existing) {
      const option = document.createElement("option");
      option.value = newValue;
      option.textContent = newValue;
      statSelect.insertBefore(option, statSelect.querySelector(`option[value="${ADD_NEW_VALUE}"]`));
    }
    statSelect.value = newValue;
    previousStatValue = newValue;

    statOptionsBySport[currentSport] = Array.from(
      new Set([...(statOptionsBySport[currentSport] || []), newValue]),
    ).sort((a, b) => a.localeCompare(b));

    await fetch("/api/admin/prop-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stat", value: newValue, sport: currentSport }),
    });
  });
}

const manageModal = document.getElementById("manage-options-modal");
const manageTitle = document.getElementById("manage-options-title");
const manageList = document.getElementById("manage-options-list");
const manageClose = document.getElementById("manage-options-close");

const MANAGE_LABELS = { sport: "Sports", player: "Players", stat: "Stats" };

function renderManageRow(value, onDelete) {
  const row = document.createElement("div");
  row.className = "manage-option-row";

  const label = document.createElement("span");
  label.textContent = value;
  row.appendChild(label);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", onDelete);
  row.appendChild(deleteBtn);

  return row;
}

function renderManageEmpty(message) {
  const empty = document.createElement("p");
  empty.className = "manage-options-empty";
  empty.textContent = message;
  return empty;
}

// Deleting an option only removes it from the explicit propOptions list —
// if a scheduled/live prop still uses this exact value, it keeps showing up
// via the "used" fallback in listOptions/listStatOptionsBySport (see
// src/lib/propOptions.ts) until that prop is closed or deleted.
async function deleteManagedOption(type, value, sport) {
  if (!confirm(`Delete "${value}"?`)) return;

  const response = await fetch("/api/admin/prop-options", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, value, sport }),
  });

  if (!response.ok) {
    alert("Failed to delete option.");
    return;
  }

  if (type === "stat" && sport) {
    statOptionsBySport[sport] = (statOptionsBySport[sport] || []).filter((s) => s !== value);
    if (document.getElementById("sport").value === sport) {
      populateStatOptions(sport);
    }
  } else {
    const select = document.getElementById(type);
    const option = select && Array.from(select.options).find((opt) => opt.value === value);
    if (option) {
      const wasSelected = select.value === value;
      option.remove();
      if (wasSelected) select.value = "";
    }
  }

  renderManageList(type);
}

function renderManageList(type) {
  manageList.innerHTML = "";
  manageTitle.textContent = `Manage ${MANAGE_LABELS[type]}`;

  if (type === "stat") {
    const sport = document.getElementById("sport").value;
    if (!sport || sport === ADD_NEW_VALUE) {
      manageList.appendChild(renderManageEmpty("Select a sport first — stats are managed per sport."));
      return;
    }
    manageTitle.textContent = `Manage Stats — ${sport}`;
    const stats = statOptionsBySport[sport] || [];
    if (stats.length === 0) {
      manageList.appendChild(renderManageEmpty("No stats yet for this sport."));
      return;
    }
    stats.forEach((stat) => {
      manageList.appendChild(renderManageRow(stat, () => deleteManagedOption("stat", stat, sport)));
    });
    return;
  }

  const select = document.getElementById(type);
  const values = select
    ? Array.from(select.options)
        .map((opt) => opt.value)
        .filter((value) => value && value !== ADD_NEW_VALUE && !value.startsWith("user:"))
    : [];

  if (values.length === 0) {
    manageList.appendChild(renderManageEmpty("Nothing to manage yet."));
    return;
  }

  values.forEach((value) => {
    manageList.appendChild(renderManageRow(value, () => deleteManagedOption(type, value, null)));
  });
}

document.querySelectorAll(".manage-options-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    renderManageList(btn.dataset.optionType);
    manageModal.classList.add("open");
  });
});

manageClose?.addEventListener("click", () => manageModal.classList.remove("open"));

function toLocalDateTimeInputValue(isoString) {
  const date = new Date(isoString);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function resetForm() {
  form.reset();
  idField.value = "";
  formTitle.textContent = "New Prop";
  submitBtn.textContent = "Create Prop";
  cancelBtn.hidden = true;
  errorBox.textContent = "";
}

function populateFormForEdit(prop) {
  idField.value = prop.id;
  document.getElementById("sport").value = prop.sport;
  populateStatOptions(prop.sport);
  document.getElementById("player").value = prop.playerUserId ? `user:${prop.playerUserId}` : prop.player;
  document.getElementById("team").value = prop.team ?? "";
  document.getElementById("stat").value = prop.stat;
  document.getElementById("line").value = prop.line;
  document.getElementById("startTime").value = toLocalDateTimeInputValue(prop.startTime);
  formTitle.textContent = `Edit ${prop.player}`;
  submitBtn.textContent = "Save Changes";
  cancelBtn.hidden = false;
  errorBox.textContent = "";
  form.scrollIntoView({ behavior: "smooth" });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const startTimeValue = document.getElementById("startTime").value;
    const playerSelect = document.getElementById("player");
    const playerRaw = playerSelect.value;
    const isRegisteredUser = playerRaw.startsWith("user:");
    const body = {
      sport: document.getElementById("sport").value,
      player: isRegisteredUser
        ? playerSelect.options[playerSelect.selectedIndex].textContent
        : playerRaw,
      playerUserId: isRegisteredUser ? playerRaw.slice("user:".length) : null,
      team: document.getElementById("team").value || null,
      stat: document.getElementById("stat").value,
      line: Number(document.getElementById("line").value),
      startTime: new Date(startTimeValue).toISOString(),
    };

    const isEdit = Boolean(idField.value);
    const url = isEdit ? `/api/admin/props/${idField.value}` : "/api/admin/props";
    const method = isEdit ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      errorBox.textContent = data.error || "Something went wrong.";
      return;
    }

    location.reload();
  });

  cancelBtn.addEventListener("click", resetForm);
}

const FALLBACK_SPORTS = ["NBA", "NFL", "MLB", "NHL"];
const FALLBACK_PLAYERS = [
  "Alex Johnson",
  "Sam Rivera",
  "Jordan Lee",
  "Casey Morgan",
  "Taylor Brooks",
];
const FALLBACK_STATS = ["Points", "Rebounds", "Assists", "Yards", "Strikeouts"];

function optionValues(selectId, fallback) {
  const select = document.getElementById(selectId);
  const values = select
    ? Array.from(select.options)
        .map((opt) => opt.value)
        .filter((value) => value && value !== ADD_NEW_VALUE && !value.startsWith("user:"))
    : [];
  return values.length > 0 ? values : fallback;
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomProp(sports, players, statsBySport) {
  const startTime = new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60) * 60000);
  const sport = randomChoice(sports);
  const statsForSport = statsBySport[sport]?.length ? statsBySport[sport] : FALLBACK_STATS;
  return {
    sport,
    player: randomChoice(players),
    team: null,
    stat: randomChoice(statsForSport),
    line: Math.round(Math.random() * 60) / 2,
    startTime: startTime.toISOString(),
  };
}

const seedBtn = document.getElementById("seed-props-btn");
seedBtn?.addEventListener("click", async () => {
  const sports = optionValues("sport", FALLBACK_SPORTS);
  const players = optionValues("player", FALLBACK_PLAYERS);

  const count = 3 + Math.floor(Math.random() * 6); // 3-8 props
  seedBtn.disabled = true;
  seedBtn.textContent = `Seeding ${count} props...`;

  try {
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        fetch("/api/admin/props", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(randomProp(sports, players, statOptionsBySport)),
        }),
      ),
    );

    if (results.some((res) => !res.ok)) {
      alert("Some random props failed to create.");
    }
  } finally {
    location.reload();
  }
});

document.querySelectorAll(".admin-prop").forEach((card) => {
  const prop = JSON.parse(card.dataset.prop);

  card.querySelector(".edit-btn")?.addEventListener("click", () => {
    populateFormForEdit(prop);
  });

  card.querySelector(".delete-btn")?.addEventListener("click", async () => {
    if (!confirm(`Delete prop for ${prop.player}?`)) return;
    const response = await fetch(`/api/admin/props/${prop.id}`, { method: "DELETE" });
    if (response.ok) {
      location.reload();
    } else {
      alert("Failed to delete prop.");
    }
  });

  const closeForm = card.querySelector(".close-form");
  closeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(closeForm);
    const result = formData.get("result");
    if (!result) return;

    const finalValueRaw = formData.get("finalValue");
    const finalValue = finalValueRaw && finalValueRaw.trim() !== "" ? Number(finalValueRaw) : null;

    const response = await fetch(`/api/admin/props/${prop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", result, finalValue }),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert("Failed to close prop.");
    }
  });
});
