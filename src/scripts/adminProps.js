const form = document.getElementById("prop-form");
const idField = document.getElementById("prop-id");
const formTitle = document.getElementById("prop-form-title");
const submitBtn = document.getElementById("prop-form-submit");
const cancelBtn = document.getElementById("prop-form-cancel");
const errorBox = document.getElementById("form-error");

const ADD_NEW_VALUE = "__add_new__";
const OPTION_FIELDS = [
  { id: "sport", type: "sport", label: "sport" },
  { id: "player", type: "player", label: "player" },
  { id: "stat", type: "stat", label: "stat" },
];

OPTION_FIELDS.forEach(({ id, type, label }) => {
  const select = document.getElementById(id);
  if (!select) return;

  let previousValue = select.value;

  select.addEventListener("change", async () => {
    if (select.value !== ADD_NEW_VALUE) {
      previousValue = select.value;
      return;
    }

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
    previousValue = newValue;

    await fetch("/api/admin/prop-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: newValue }),
    });
  });
});

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
  document.getElementById("player").value = prop.player;
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
    const body = {
      sport: document.getElementById("sport").value,
      player: document.getElementById("player").value,
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
        .filter((value) => value && value !== ADD_NEW_VALUE)
    : [];
  return values.length > 0 ? values : fallback;
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomProp(sports, players, stats) {
  const startTime = new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60) * 60000);
  return {
    sport: randomChoice(sports),
    player: randomChoice(players),
    team: null,
    stat: randomChoice(stats),
    line: Math.round(Math.random() * 60) / 2,
    startTime: startTime.toISOString(),
  };
}

const seedBtn = document.getElementById("seed-props-btn");
seedBtn?.addEventListener("click", async () => {
  const sports = optionValues("sport", FALLBACK_SPORTS);
  const players = optionValues("player", FALLBACK_PLAYERS);
  const stats = optionValues("stat", FALLBACK_STATS);

  const count = 3 + Math.floor(Math.random() * 6); // 3-8 props
  seedBtn.disabled = true;
  seedBtn.textContent = `Seeding ${count} props...`;

  try {
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        fetch("/api/admin/props", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(randomProp(sports, players, stats)),
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
    const result = new FormData(closeForm).get("result");
    if (!result) return;

    const response = await fetch(`/api/admin/props/${prop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", result }),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert("Failed to close prop.");
    }
  });
});
