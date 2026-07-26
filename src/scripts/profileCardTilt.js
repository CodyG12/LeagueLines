const PREFERS_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const DEFAULT_TAU = 0.14;

const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v, precision = 3) => parseFloat(v.toFixed(precision));

function createTiltEngine(wrap, shell) {
  let rafId = null;
  let running = false;
  let lastTs = 0;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  const setVarsFromXY = (x, y) => {
    const width = shell.clientWidth || 1;
    const height = shell.clientHeight || 1;
    const percentX = clamp((100 / width) * x);
    const percentY = clamp((100 / height) * y);
    const centerX = percentX - 50;
    const centerY = percentY - 50;

    const properties = {
      "--pointer-from-top": `${percentY / 100}`,
      "--pointer-from-left": `${percentX / 100}`,
      "--rotate-x": `${round(-(centerX / 5))}deg`,
      "--rotate-y": `${round(centerY / 4)}deg`,
    };
    for (const [key, value] of Object.entries(properties)) wrap.style.setProperty(key, value);
  };

  const step = (ts) => {
    if (!running) return;
    if (lastTs === 0) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    const k = 1 - Math.exp(-dt / DEFAULT_TAU);
    currentX += (targetX - currentX) * k;
    currentY += (targetY - currentY) * k;
    setVarsFromXY(currentX, currentY);

    const stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;
    if (stillFar || document.hasFocus()) {
      rafId = requestAnimationFrame(step);
    } else {
      running = false;
      lastTs = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    lastTs = 0;
    rafId = requestAnimationFrame(step);
  };

  return {
    setImmediate(x, y) {
      currentX = x;
      currentY = y;
      setVarsFromXY(currentX, currentY);
    },
    setTarget(x, y) {
      targetX = x;
      targetY = y;
      start();
    },
    toCenter() {
      this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
    },
    getCurrent() {
      return { x: currentX, y: currentY, tx: targetX, ty: targetY };
    },
  };
}

function getOffsets(event, el) {
  const rect = el.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function initCard(wrap) {
  const shell = wrap.querySelector(".pc-card-shell");
  if (!shell) return;

  wrap.style.setProperty("--rotate-x", "0deg");
  wrap.style.setProperty("--rotate-y", "0deg");

  if (PREFERS_REDUCED_MOTION) return;

  const engine = createTiltEngine(wrap, shell);
  let leaveRafId = null;

  engine.setImmediate(shell.clientWidth / 2, shell.clientHeight / 2);

  shell.addEventListener("pointerenter", (event) => {
    shell.classList.add("active");
    const { x, y } = getOffsets(event, shell);
    engine.setTarget(x, y);
  });

  shell.addEventListener("pointermove", (event) => {
    const { x, y } = getOffsets(event, shell);
    engine.setTarget(x, y);
  });

  shell.addEventListener("pointerleave", () => {
    engine.toCenter();
    const checkSettle = () => {
      const { x, y, tx, ty } = engine.getCurrent();
      if (Math.hypot(tx - x, ty - y) < 0.6) {
        shell.classList.remove("active");
        leaveRafId = null;
      } else {
        leaveRafId = requestAnimationFrame(checkSettle);
      }
    };
    if (leaveRafId) cancelAnimationFrame(leaveRafId);
    leaveRafId = requestAnimationFrame(checkSettle);
  });
}

function init() {
  document.querySelectorAll(".pc-card-wrapper").forEach(initCard);
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
