export function animateNumber(el, from, to, options = {}) {
  const { duration = 600, prefix = "", suffix = "", decimals = 0 } = options;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || from === to) {
    el.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
    return;
  }

  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + (to - from) * eased;
    el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
    }
  }

  requestAnimationFrame(tick);
}
