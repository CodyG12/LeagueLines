# Auth Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/login`, `/signup`, and `/admin/login` from today's plain stacked-input forms into a dark, pill-input, glass-card auth screen (inspired by a referenced Dribbble shot and PrizePicks' login, adapted into our own design system — Trophy Gold CTA, existing frosted-glass card treatment, existing Beams background) — without adding any new functionality (no OAuth, no remember-me, no password reset) and without touching the unrelated admin "New Prop" form that currently shares CSS classes with these pages.

**Architecture:** New `.auth-*` CSS classes are added to `src/styles/global.css` (additive only — nothing existing is redefined or removed), then each of the three page files is rewritten to use them: same `<Beams />` + `.page-bg.beams-page-bg` background pattern already used by `Home.astro`/`my-bets.astro`, a `.site-brand` wordmark link (reused verbatim from `Nav.astro`), and a centered `.auth-card` containing the form. Field inputs move from bare `<input>` elements to icon-prefixed pill wrappers (`.auth-input-wrap`). No backend/API route changes — same field names, same `error=` query-param branches, same `action`/`method`/`enctype` on every form.

**Tech Stack:** Astro (server output), vanilla CSS (existing design tokens only, no framework), the existing `Beams` React/WebGL background component (`client:load`).

## Global Constraints

- This codebase has **no automated test framework** (no test runner in `package.json`, no `*.test.*` files). Verify every task with `npx astro check` (type/template safety) plus manual browser verification against the dev server (`npm run dev`).
- Use only existing design tokens from `src/styles/global.css` `:root` (`--space-*`, `--radius-*`, `--secondary-text`, `--primary-text`, `--highlight-color`, `--danger-color`, `--font-display`, `--shadow-card`, `--ease-spring`) — no new colors, fonts, or radii, per `DESIGN.md`.
- No icon library — hand-written inline `<svg>` icons only (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="1.6"`, rounded caps/joins), matching the convention already used for sport icons and the bottom nav.
- Do not modify `.admin-form`, `.admin-login`, `.field`, `.field-row`, or `.form-error` — they're shared with `src/pages/admin/props.astro`'s "New Prop" form, which is out of scope. `.field` and `.field-row` are *reused* (not modified) for label/input stacking and the first-/last-name grid.
- Do not modify `src/pages/api/auth/login.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/admin/login.ts`, or any session/auth logic — every `error=` branch, field `name` attribute, form `action`, `method`, and `enctype` must stay byte-for-byte identical to today so the existing backend keeps working unmodified.
- No social login buttons, no "remember me", no "forgot password" link — confirmed out of scope in the design spec (`docs/superpowers/specs/2026-07-26-auth-pages-redesign-design.md`).

---

## Task 1: Add shared `.auth-*` CSS and rewrite `/login`

**Why first:** `/login` is the simplest of the three pages (two fields, no avatar section) and exercises every new CSS class except the sprite grid, making it the fastest page to validate the whole shared style sheet against.

**Files:**
- Modify: `src/styles/global.css` (append new rules; nothing existing is changed)
- Modify: `src/pages/login.astro`

**Interfaces:**
- Consumes: existing tokens/classes only — `--space-*`, `--radius-pill`, `--radius-sm`, `--radius-lg`, `--secondary-text`, `--primary-text`, `--highlight-color`, `--danger-color`, `--font-display`, `--shadow-card`, `.page-bg`, `.beams-page-bg`, `.site-brand`, `.site-brand-league`, `.site-brand-lines`, `.nav-raise`, `.field`, `.field-row`, the sitewide `button` and `input[type=...]` base rules.
- Produces (for Tasks 2 and 3 to consume): `.auth-page`, `.auth-card`, `.auth-card h2`, `.auth-form`, `.auth-form label`, `.auth-form button[type="submit"]`, `.auth-input-wrap`, `.auth-input-wrap .auth-input`, `.auth-input-icon`, `.auth-error`, `.auth-footer-link`. Markup convention: every text/password field is `<div class="field"><label for="…">…</label><div class="auth-input-wrap"><svg class="auth-input-icon">…</svg><input class="auth-input" …/></div></div>`.

- [ ] **Step 1: Append the new CSS rules to `src/styles/global.css`**

Add this block at the end of the file:

```css

/* Auth pages (login, signup, admin login) — dark glass card + pill inputs.
   Additive only: none of the rules above (.admin-form, .field, .field-row,
   .form-error) are touched, since those are shared with the admin "New
   Prop" form. */
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
}

.auth-card h2 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 var(--space-5);
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-align: left;
}

.auth-form label {
  font-size: 0.85rem;
  color: var(--secondary-text);
}

.auth-form button[type="submit"] {
  width: 100%;
  padding: var(--space-4) var(--space-5);
  margin-top: var(--space-2);
}

.auth-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.15);
  background-color: rgba(255, 255, 255, 0.06);
  padding: var(--space-3) var(--space-4);
  transition: border-color 0.2s ease-in-out;
}

.auth-input-wrap:focus-within {
  border-color: var(--highlight-color);
}

.auth-input-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--secondary-text);
}

/* Specificity note: input[type="text"] etc. (src/styles/global.css:186-199)
   is one attribute selector + one element (0,1,1). A bare ".auth-input"
   class alone is only (0,1,0) and would lose to it. Pairing with the
   ".auth-input-wrap" ancestor class gives (0,2,0), which always wins
   regardless of source order. */
.auth-input-wrap .auth-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 0.95rem;
  color: var(--primary-text);
}

.auth-input-wrap .auth-input:focus {
  outline: none;
}

.auth-error {
  color: var(--danger-color);
  background: rgba(255, 69, 58, 0.12);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 0.85rem;
  margin: 0 0 var(--space-4);
}

.auth-footer-link {
  text-align: center;
  color: var(--secondary-text);
  font-size: 0.9rem;
}
```

- [ ] **Step 2: Rewrite `src/pages/login.astro`**

Replace the entire file with:

```astro
---
import Layout from "../layouts/Layout.astro";
import Beams from "../components/react/Beams";

const hasError = Astro.url.searchParams.has("error");
---

<Layout>
  <div class="page-bg beams-page-bg">
    <Beams
      client:load
      beamWidth={2}
      beamHeight={15}
      beamNumber={12}
      lightColor="#7c5cfc"
      secondaryLightColor="#d4a72c"
      speed={2}
      noiseIntensity={1.75}
      scale={0.2}
      rotation={0}
      backgroundColor="#050506"
    />
  </div>
  <main class="auth-page">
    <a href="/" class="site-brand nav-raise">
      <span class="site-brand-league">League</span><span class="site-brand-lines">Lines</span>
    </a>
    <div class="auth-card">
      <h2>Log In</h2>
      {hasError && <p class="auth-error">Invalid username or password.</p>}
      <form method="POST" action="/api/auth/login" class="auth-form" data-astro-reload>
        <div class="field">
          <label for="username">Username</label>
          <div class="auth-input-wrap">
            <svg
              class="auth-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
            </svg>
            <input class="auth-input" type="text" id="username" name="username" required autofocus />
          </div>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="auth-input-wrap">
            <svg
              class="auth-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            <input class="auth-input" type="password" id="password" name="password" required />
          </div>
        </div>
        <button type="submit">Log In</button>
      </form>
    </div>
    <p class="auth-footer-link">Need an account? <a href="/signup">Sign up</a></p>
  </main>
</Layout>
```

- [ ] **Step 3: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors` (warnings/hints unrelated to this change, e.g. the pre-existing `my-bets.astro` inline-script hint, are fine).

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev` (if not already running), then open `http://localhost:4321/login`.

Confirm:
- The animated Beams gradient is visible behind the card.
- "LeagueLines" wordmark appears above the card and links to `/`.
- Username and password fields are pill-shaped with a leading icon (person icon for username, lock icon for password).
- The "Log In" button is a full-width gold pill.
- "Need an account? Sign up" appears below the card, and the link navigates to `/signup`.
- Visiting `http://localhost:4321/login?error=1` shows the red error banner ("Invalid username or password.") as a tinted pill above the form, not bare red text.
- Submit the form with a valid existing username/password (or any username/password if you don't have one handy — an invalid submission should redirect back to `/login?error` and show the same styled error banner, confirming the form still posts to `/api/auth/login` correctly).

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/pages/login.astro
git commit -m "Restyle /login with pill inputs and glass card"
```

---

## Task 2: Rewrite `/signup`

**Files:**
- Modify: `src/pages/signup.astro`

**Interfaces:**
- Consumes: every class produced by Task 1 (`.auth-page`, `.auth-card`, `.auth-form`, `.auth-input-wrap`, `.auth-input-icon`, `.auth-input`, `.auth-error`, `.auth-footer-link`), plus pre-existing `.field-row` (2-column grid, already responsive under 640px) and `.sprite-picker-grid`/`.sprite-option-wrap`/`.sprite-radio`/`.sprite-option` (unmodified, from `src/styles/global.css:1422+`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Rewrite `src/pages/signup.astro`**

Replace the entire file with:

```astro
---
import Layout from "../layouts/Layout.astro";
import Beams from "../components/react/Beams";
import { SPRITE_AVATARS } from "../lib/sprites";

const error = Astro.url.searchParams.get("error");
---

<Layout>
  <div class="page-bg beams-page-bg">
    <Beams
      client:load
      beamWidth={2}
      beamHeight={15}
      beamNumber={12}
      lightColor="#7c5cfc"
      secondaryLightColor="#d4a72c"
      speed={2}
      noiseIntensity={1.75}
      scale={0.2}
      rotation={0}
      backgroundColor="#050506"
    />
  </div>
  <main class="auth-page">
    <a href="/" class="site-brand nav-raise">
      <span class="site-brand-league">League</span><span class="site-brand-lines">Lines</span>
    </a>
    <div class="auth-card">
      <h2>Sign Up</h2>
      {error === "duplicate" && <p class="auth-error">An account with that username already exists.</p>}
      {error === "missing-fields" && <p class="auth-error">Please fill out all fields.</p>}
      {error === "invalid-username" && (
        <p class="auth-error">Username must be 3–20 characters, using only letters, numbers, and underscores.</p>
      )}
      {error === "short-password" && <p class="auth-error">Password must be at least 8 characters.</p>}
      {error === "invalid-avatar-type" && (
        <p class="auth-error">Profile picture must be a PNG, JPEG, WEBP, or GIF image.</p>
      )}
      {error === "avatar-too-large" && <p class="auth-error">Profile picture must be smaller than 5MB.</p>}
      {error === "avatar-upload-failed" && (
        <p class="auth-error">
          We couldn't upload your profile picture right now. Please try again, or pick one of the mascot avatars
          instead.
        </p>
      )}
      <form method="POST" action="/api/auth/signup" class="auth-form" enctype="multipart/form-data" data-astro-reload>
        <div class="field-row">
          <div class="field">
            <label for="firstName">First Name</label>
            <div class="auth-input-wrap">
              <svg
                class="auth-input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
              </svg>
              <input class="auth-input" type="text" id="firstName" name="firstName" required autofocus />
            </div>
          </div>
          <div class="field">
            <label for="lastName">Last Name</label>
            <div class="auth-input-wrap">
              <svg
                class="auth-input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
              </svg>
              <input class="auth-input" type="text" id="lastName" name="lastName" required />
            </div>
          </div>
        </div>
        <div class="field">
          <label for="username">Username</label>
          <div class="auth-input-wrap">
            <svg
              class="auth-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
            </svg>
            <input
              class="auth-input"
              type="text"
              id="username"
              name="username"
              minlength="3"
              maxlength="20"
              pattern="[a-zA-Z0-9_]{3,20}"
              title="3-20 characters: letters, numbers, and underscores only"
              required
            />
          </div>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="auth-input-wrap">
            <svg
              class="auth-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            <input class="auth-input" type="password" id="password" name="password" minlength="8" required />
          </div>
        </div>
        <div class="field">
          <label for="avatar">Profile Picture (optional)</label>
          <input type="file" id="avatar" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" />
        </div>
        <div class="field">
          <label>Or pick an avatar (optional)</label>
          <div class="sprite-picker-grid">
            {SPRITE_AVATARS.map((sprite, index) => (
              <span class="sprite-option-wrap">
                <input type="radio" id={`sprite-${index}`} name="avatarSprite" value={sprite} class="sprite-radio" />
                <label for={`sprite-${index}`} class="sprite-option">
                  <img src={sprite} alt="" loading="lazy" />
                </label>
              </span>
            ))}
          </div>
        </div>
        <button type="submit">Sign Up</button>
      </form>
    </div>
    <p class="auth-footer-link">Already have an account? <a href="/login">Log in</a></p>
  </main>
</Layout>
```

- [ ] **Step 2: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Manually verify in the browser**

Open `http://localhost:4321/signup`.

Confirm:
- Same Beams background, wordmark, and card treatment as `/login`.
- First Name / Last Name sit side by side (2-column), each with a person icon; both collapse to a single column under 640px width (resize the window to confirm).
- Username and Password are pill inputs with icons, matching `/login`.
- "Profile Picture (optional)" shows the native file picker (unstyled — this is intentional, not a bug) and the mascot sprite grid below it still renders and is still selectable (click a sprite, confirm it gets the gold selected-border treatment it already had).
- Trigger at least one error state, e.g. visit `http://localhost:4321/signup?error=duplicate`, and confirm the red tinted-pill error banner renders (matching `/login`'s error style) with the correct message text.
- Submit the form with a new unique username, a password ≥8 characters, and a selected mascot sprite (skip the file upload) — confirm it successfully creates the account and redirects to `/` (this exercises the unmodified `signup.ts` API route end-to-end against the new markup).

- [ ] **Step 4: Commit**

```bash
git add src/pages/signup.astro
git commit -m "Restyle /signup with pill inputs and glass card"
```

---

## Task 3: Rewrite `/admin/login`

**Files:**
- Modify: `src/pages/admin/login.astro`

**Interfaces:**
- Consumes: same classes as Task 1/2 (`.auth-page`, `.auth-card`, `.auth-form`, `.auth-input-wrap`, `.auth-input-icon`, `.auth-input`, `.auth-error`).
- Produces: nothing new.

- [ ] **Step 1: Rewrite `src/pages/admin/login.astro`**

Replace the entire file with:

```astro
---
import Layout from "../../layouts/Layout.astro";
import Beams from "../../components/react/Beams";

const hasError = Astro.url.searchParams.has("error");
---

<Layout>
  <div class="page-bg beams-page-bg">
    <Beams
      client:load
      beamWidth={2}
      beamHeight={15}
      beamNumber={12}
      lightColor="#7c5cfc"
      secondaryLightColor="#d4a72c"
      speed={2}
      noiseIntensity={1.75}
      scale={0.2}
      rotation={0}
      backgroundColor="#050506"
    />
  </div>
  <main class="auth-page">
    <a href="/" class="site-brand nav-raise">
      <span class="site-brand-league">League</span><span class="site-brand-lines">Lines</span>
    </a>
    <div class="auth-card">
      <h2>Admin Login</h2>
      {hasError && <p class="auth-error">Invalid password.</p>}
      <form method="POST" action="/api/admin/login" class="auth-form" data-astro-reload>
        <div class="field">
          <label for="password">Password</label>
          <div class="auth-input-wrap">
            <svg
              class="auth-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            <input class="auth-input" type="password" id="password" name="password" required autofocus />
          </div>
        </div>
        <button type="submit">Log In</button>
      </form>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Run `npx astro check`**

Run: `npx astro check`
Expected: `0 errors`.

- [ ] **Step 3: Manually verify in the browser**

Open `http://localhost:4321/admin/login`.

Confirm:
- Same Beams background, wordmark, and glass card treatment.
- Single password field, pill-shaped with the lock icon.
- No bottom nav bar renders on this page (unchanged existing behavior — `Layout.astro` skips it for `/admin/*` routes).
- Submitting the correct admin password (from `ADMIN_PASSWORD` in `.env`) logs in and redirects to `/admin/props`; submitting an incorrect password redirects back here with the styled "Invalid password." error banner.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/login.astro
git commit -m "Restyle /admin/login with pill inputs and glass card"
```

---

## Final check

- [ ] **Run `npx astro build` once, end to end**

Run: `npx astro build`
Expected: build completes with no errors (confirms all three pages still produce valid server output, not just pass the type checker).
