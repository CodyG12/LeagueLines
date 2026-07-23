# Bottom Nav + Bet-Slip Docking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent 4-tab bottom nav (Props / My Bets / Leaderboard / Account) to every public page, dock the existing bet-slip summary bar above it instead of at the viewport edge, and build the two missing destinations (`/leaderboard`, `/account`) the nav links to.

**Architecture:** A new `BottomNav.astro` component is rendered once, inside the shared `Layout.astro`, so every page that uses `<Layout>` gets it automatically (skipped on `/admin/*`). This requires first fixing `Home.astro`, which currently renders its own duplicate `<html>/<head>/<body>` even when nested inside `<Layout>` — it becomes a plain fragment. The bet-slip bar (`.modal-div`, already `position: fixed`) docks above the nav via a `--bottom-nav-height` CSS custom property, no JS changes. The two new pages are server-rendered Astro pages reusing existing data-access functions (`listAllUsers`) — no new backend code.

**Tech Stack:** Astro (server output, `@astrojs/node` adapter), vanilla CSS (custom properties, no framework), MongoDB via existing `src/lib/*` modules. No client-side JS changes in this plan.

## Global Constraints

- This codebase has **no automated test framework** (no test runner in `package.json`, no `*.test.*` files anywhere). Do not introduce one. Verify each task with `npx astro check` (type/template safety) plus manual browser verification against the dev server (`npm run dev`, already running on `localhost:4321` in this environment) — this matches how the admin-form alignment fix earlier in this project was verified, and how the `2026-07-16-profile-pictures` plan was verified.
- Follow existing code style: no comments except where a non-obvious constraint needs explaining; this repo's files have almost none.
- Use only existing design tokens from `src/styles/global.css` `:root` (`--space-*`, `--radius-*`, `--secondary-bg`, `--secondary-text`, `--primary-text`, `--highlight-color`, `--font-num`, `--shadow-card`) — no new colors, fonts, or radii, per `DESIGN.md`.
- No icon library dependency — hand-written inline `<svg>` icons only (stroke-based, `currentColor`, ~24×24).
- `/leaderboard` is public (no auth guard). `/account` is auth-gated, redirecting to `/login` exactly like `/my-bets` does today (`if (!Astro.locals.user) return Astro.redirect("/login");`).

---

## Task 1: Fold `Home.astro` into `Layout.astro`'s shell

**Why first:** Every later task (BottomNav in `Layout`, bet-slip docking) depends on there being exactly one `<html>/<head>/<body>` per page. Today `Home.astro` renders its own full document even when nested inside `<Layout>` (via `index.astro` and `leagues/[sport].astro`), producing two conflicting `<body>` elements on those pages.

**Files:**
- Modify: `src/components/Home.astro` (currently 122 lines)
- Modify: `src/layouts/Layout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/leagues/[sport].astro`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Home.astro` is now a fragment (no `<html>/<head>/<body>`, no `<Footer />`, no `<script>` tags) — callers must provide the four scripts themselves. `Layout.astro`'s `<body>` now carries `data-logged-in`, which `src/scripts/betSlip.js:14` already reads via `document.body.dataset.loggedIn === "true"`.

- [ ] **Step 1: Rewrite `src/components/Home.astro` as a fragment**

Replace the entire file with:

```astro
---
import Header from "./sub_components/Header.astro";
import Beams from "./react/Beams";
import { listPublicProps, listPublicPropsBySport } from "../lib/props";

interface Props {
  sport?: string;
}

const { sport } = Astro.props as Props;
const playerProps = sport ? await listPublicPropsBySport(sport) : await listPublicProps();
const heading = sport ? `${sport} Props` : "Player Props";
---

<div class="page-bg beams-page-bg">
  <Beams
    client:load
    beamWidth={2}
    beamHeight={15}
    beamNumber={12}
    lightColor="#d4a72c"
    secondaryLightColor="#7c5cfc"
    speed={2}
    noiseIntensity={1.75}
    scale={0.2}
    rotation={0}
    backgroundColor="#050506"
  />
</div>

<!-- Header -->
<Header />

<!-- Player Prop Bets -->
<main class="container">
  <h2 class="title">{heading}</h2>

  <div class="grid">
    {playerProps.map((prop) => (
      <div /*key={prop.id}*/ class="pc-card-wrapper player-prop">
        <div class="pc-card-shell">
          <section class="pc-card">
            <div class="pc-inside">
              <div class="pc-content pc-avatar-content">
                {prop.playerAvatarUrl && (
                  <img class="avatar" src={prop.playerAvatarUrl} alt="" loading="lazy" />
                )}
                <div class="pc-bottom">
                  <div class="pc-user-info">
                    <div class="pc-mini-avatar">
                      <img src={prop.playerAvatarUrl ?? "/avatar-placeholder.svg"} alt="" loading="lazy" />
                    </div>
                    <div class="pc-handle">{prop.sport}</div>
                  </div>
                  <div class="pc-bet-options">
                    <button data-prop={JSON.stringify(prop)} class="over-btn">Over</button>
                    <button data-prop={JSON.stringify(prop)} class="under-btn">Under</button>
                  </div>
                </div>
              </div>
              <div class="pc-content">
                <div class="pc-details">
                  <h3>{prop.player}</h3>
                  <p>{prop.line} {prop.stat}</p>
                  <span class="pc-time">{prop.displayTime}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    ))}
  </div>
</main>

<div class="modal-div">
  <button class="open-modal" id="openModal" type="button">
    <span class="betslip-summary-text">
      <strong id="betslip-count">0 Picks</strong>
      <span id="betslip-payout"></span>
    </span>
    <span class="betslip-chevron" aria-hidden="true">▲</span>
  </button>
  <div class="modal" id="modal">
    <div class="modal-inner">
      <h2>Your Picks</h2>
      <div id="bet-slip-legs"></div>

      <p class="bet-mode-label" id="bet-mode-label"></p>

      <div id="parlay-stake-wrap" hidden>
        <label for="parlayStake">Total stake</label>
        <input type="number" id="parlayStake" min="1" step="1" />
      </div>

      <p class="bet-slip-summary" id="bet-slip-summary"></p>
      <div id="bet-slip-error" class="form-error"></div>

      <button id="placeBetBtn" type="button">Place Bet(s)</button>
      <button id="closeModal" type="button" class="secondary-btn">Close</button>
    </div>
  </div>
</div>
```

Changes from the original: no `<html>/<head>/<body>` wrapper, no duplicate `<meta viewport>`/stylesheet `<link>`, no four `<script>` tags, no `<Footer />` (dropped — its purpose, sitewide navigation chrome, is now superseded by the persistent `BottomNav` added in Task 4; `Footer.astro` itself is untouched and still used by the logged-out landing page in `index.astro`).

- [ ] **Step 2: Add `data-logged-in` to `Layout.astro`'s `<body>`**

In `src/layouts/Layout.astro`, change:

```astro
  <body>
    <slot />
  </body>
```

to:

```astro
  <body data-logged-in={Astro.locals.user ? "true" : "false"}>
    <slot />
  </body>
```

- [ ] **Step 3: Add the four scripts to `src/pages/index.astro`**

Change the logged-in branch from:

```astro
{
  user && (
    <Layout>
      <Home />
    </Layout>
  )
}
```

to:

```astro
{
  user && (
    <Layout>
      <script type="module" src="/src/scripts/modal.js"></script>
      <script type="module" src="/src/scripts/buttonColor.js"></script>
      <script type="module" src="/src/scripts/betSlip.js"></script>
      <script type="module" src="/src/scripts/profileCardTilt.js"></script>
      <Home />
    </Layout>
  )
}
```

- [ ] **Step 4: Add the four scripts to `src/pages/leagues/[sport].astro`**

Change:

```astro
<Layout>
  <Home sport={sport} />
</Layout>
```

to:

```astro
<Layout>
  <script type="module" src="/src/scripts/modal.js"></script>
  <script type="module" src="/src/scripts/buttonColor.js"></script>
  <script type="module" src="/src/scripts/betSlip.js"></script>
  <script type="module" src="/src/scripts/profileCardTilt.js"></script>
  <Home sport={sport} />
</Layout>
```

- [ ] **Step 5: Type-check**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 6: Manually verify in the browser**

With the dev server running (`npm run dev`), open `http://localhost:4321/` while logged in (or `/leagues/<any-sport>`):
- View source / inspect: confirm there is exactly one `<html>` and one `<body>` tag.
- Confirm the page still renders the Beams background, header, prop grid.
- Click "Over" or "Under" on a prop card; confirm the bet-slip summary bar still appears at the bottom (still flush with the viewport edge for now — that changes in Task 5).
- Confirm there is no visible page-bottom copyright footer anymore on this page (it was removed in Step 1).

- [ ] **Step 7: Commit**

```bash
git add src/components/Home.astro src/layouts/Layout.astro src/pages/index.astro src/pages/leagues/\[sport\].astro
git commit -m "$(cat <<'EOF'
Fold Home.astro into Layout's shell, drop duplicate document

Home.astro rendered its own <html>/<head>/<body> even when nested inside
the shared Layout, producing two conflicting <body> elements on the props
and leagues pages. Home is now a fragment; the pages that render it declare
its scripts themselves, and Layout's <body> carries data-logged-in for
betSlip.js to read.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: New `/leaderboard` page

**Files:**
- Create: `src/pages/leaderboard.astro`
- Modify: `src/styles/global.css` (append leaderboard list styles)

**Interfaces:**
- Consumes: `listAllUsers(): Promise<PublicUser[]>` from `src/lib/users.ts` (`PublicUser` has `id`, `firstName`, `lastName`, `username`, `avatarUrl: string | null`, `units: number`).
- Produces: route `/leaderboard`, public.

- [ ] **Step 1: Create `src/pages/leaderboard.astro`**

```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/sub_components/Nav.astro";
import { listAllUsers } from "../lib/users";

const users = await listAllUsers();
const ranked = [...users].sort((a, b) => b.units - a.units);
---

<Layout>
  <Nav showCategories={false} />
  <main class="container">
    <h2 class="title">Leaderboard</h2>
    <div class="leaderboard-list">
      {ranked.map((user, index) => (
        <div class="leaderboard-row">
          <span class="leaderboard-rank">{index + 1}</span>
          <img class="prop-avatar" src={user.avatarUrl ?? "/avatar-placeholder.svg"} alt="" loading="lazy" />
          <span class="leaderboard-name">{user.firstName} {user.lastName} (@{user.username})</span>
          <span class="units-pill">{user.units} units</span>
        </div>
      ))}
      {ranked.length === 0 && <p>No users yet.</p>}
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Append leaderboard styles to `src/styles/global.css`**

Add at the end of the file (after line 1312):

```css

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  text-align: left;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--secondary-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-card);
}

.leaderboard-rank {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--highlight-color);
  width: 2ch;
  flex-shrink: 0;
  text-align: center;
}

.leaderboard-name {
  flex: 1;
  font-weight: 600;
}
```

`.prop-avatar` (64px circular avatar) and `.units-pill` are existing classes, reused as-is.

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 4: Manually verify in the browser**

Open `http://localhost:4321/leaderboard` (logged in or out — it's public):
- Confirm a list of users renders, ranked highest-units-first, each row showing rank number, avatar, name, and a units pill.
- Confirm the top nav (`Nav`) renders without the sport category tabs.
- Resize the window narrow; confirm rows don't overflow horizontally.

- [ ] **Step 5: Commit**

```bash
git add src/pages/leaderboard.astro src/styles/global.css
git commit -m "$(cat <<'EOF'
Add public /leaderboard page ranked by units

Reuses the existing listAllUsers() data access — no new backend code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: New `/account` page

**Files:**
- Create: `src/pages/account.astro`
- Modify: `src/styles/global.css` (append account card styles)

**Interfaces:**
- Consumes: `Astro.locals.user: PublicUser | null` (set by `src/middleware.ts`); `POST /api/auth/logout` (existing route, already used by `Nav.astro`'s account dropdown).
- Produces: route `/account`, auth-gated.

- [ ] **Step 1: Create `src/pages/account.astro`**

```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/sub_components/Nav.astro";

if (!Astro.locals.user) {
  return Astro.redirect("/login");
}

const user = Astro.locals.user;
---

<Layout>
  <Nav showCategories={false} />
  <main class="container admin-login">
    <h2 class="title">Account</h2>
    <div class="card account-card">
      <img class="prop-avatar" src={user.avatarUrl ?? "/avatar-placeholder.svg"} alt="" loading="lazy" />
      <h1 class="player">{user.firstName} {user.lastName}</h1>
      <p class="time">@{user.username}</p>
      <p class="units-pill">{user.units} units</p>
      <form method="POST" action="/api/auth/logout" data-astro-reload>
        <button type="submit" class="btn-outline">Log Out</button>
      </form>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Append account card styles to `src/styles/global.css`**

Add at the end of the file:

```css

.account-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}
```

`.card`, `.admin-login` (400px max-width centered container, already used by `/login` and `/signup`), `.prop-avatar`, `.player`, `.time`, `.units-pill`, and `.btn-outline` are all existing classes, reused as-is.

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 4: Manually verify in the browser**

- Logged out: open `http://localhost:4321/account` → confirm redirect to `/login`.
- Logged in: open `http://localhost:4321/account` → confirm it shows your name, `@username`, units, and a "Log Out" button that logs you out when clicked (confirm you land back on a logged-out state after clicking).

- [ ] **Step 5: Commit**

```bash
git add src/pages/account.astro src/styles/global.css
git commit -m "$(cat <<'EOF'
Add auth-gated /account page

Shows the logged-in user's info and reuses the existing logout form —
redirects to /login when logged out, matching the /my-bets guard pattern.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `BottomNav.astro` component, wired into `Layout.astro`

**Files:**
- Create: `src/components/sub_components/BottomNav.astro`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/styles/global.css` (new `:root` var + `.bottom-nav*` rules)

**Interfaces:**
- Consumes: `Astro.url.pathname` (built-in Astro global).
- Produces: `--bottom-nav-height` CSS custom property (declared in `:root`), consumed by Task 5's `.modal-div` change. `.bottom-nav` component with tabs to `/`, `/my-bets`, `/leaderboard`, `/account` (the last two now exist, from Tasks 2–3).

- [ ] **Step 1: Create `src/components/sub_components/BottomNav.astro`**

```astro
---
interface Tab {
  href: string;
  label: string;
  icon: "props" | "bets" | "leaderboard" | "account";
}

const tabs: Tab[] = [
  { href: "/", label: "Props", icon: "props" },
  { href: "/my-bets", label: "My Bets", icon: "bets" },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/account", label: "Account", icon: "account" },
];

const currentPath = Astro.url.pathname;

function isActive(href: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
---

<nav class="bottom-nav" aria-label="Primary">
  {tabs.map((tab) => (
    <a href={tab.href} class={isActive(tab.href) ? "bottom-nav-tab active" : "bottom-nav-tab"}>
      <span class="bottom-nav-icon" aria-hidden="true">
        {tab.icon === "props" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
        )}
        {tab.icon === "bets" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
        )}
        {tab.icon === "leaderboard" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
            <path d="M7 6H4a3 3 0 0 0 3 3" />
            <path d="M17 6h3a3 3 0 0 1-3 3" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
        )}
        {tab.icon === "account" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
          </svg>
        )}
      </span>
      <span class="bottom-nav-label">{tab.label}</span>
    </a>
  ))}
</nav>
```

- [ ] **Step 2: Wire `BottomNav` into `Layout.astro`, skipped on `/admin/*`**

In `src/layouts/Layout.astro`, add the import and compute the flag in the frontmatter:

```astro
---
import { ViewTransitions } from "astro:transitions";
import BottomNav from "../components/sub_components/BottomNav.astro";

const isAdminRoute = Astro.url.pathname.startsWith("/admin");
---
```

Change the body to:

```astro
  <body data-logged-in={Astro.locals.user ? "true" : "false"} class={isAdminRoute ? "" : "has-bottom-nav"}>
    <slot />
    {!isAdminRoute && <BottomNav />}
  </body>
```

- [ ] **Step 3: Add `--bottom-nav-height` to `:root` in `src/styles/global.css`**

At line 40 (right after `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);` and before the closing `}` of `:root`), add:

```css
  --bottom-nav-height: calc(64px + env(safe-area-inset-bottom, 0px));
```

- [ ] **Step 4: Append `.bottom-nav*` and `.has-bottom-nav` styles to `src/styles/global.css`**

Add at the end of the file:

```css

body.has-bottom-nav {
  padding-bottom: var(--bottom-nav-height);
}

.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 150;
  height: var(--bottom-nav-height);
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
  background-color: var(--secondary-bg);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.bottom-nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  max-width: 96px;
  color: var(--secondary-text);
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 600;
}

.bottom-nav-tab:hover {
  color: var(--primary-text);
  text-decoration: none;
}

.bottom-nav-icon {
  width: 24px;
  height: 24px;
}

.bottom-nav-icon svg {
  width: 100%;
  height: 100%;
}

.bottom-nav-tab.active {
  color: var(--primary-text);
}

.bottom-nav-tab.active .bottom-nav-icon {
  color: var(--highlight-color);
}
```

- [ ] **Step 5: Type-check**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 6: Manually verify in the browser**

- Open `http://localhost:4321/` (logged in): confirm the 4-tab bottom nav renders, "Props" is highlighted active (gold icon, white label), the other three are gray.
- Click each tab (My Bets, Leaderboard, Account, back to Props); confirm navigation works and the active tab updates correctly on each page.
- Confirm page content isn't clipped behind the bottom nav — scroll to the bottom of the props grid and confirm the last row is fully visible above the nav, not hidden underneath it.
- Open `http://localhost:4321/admin/props` (log in with the admin password from `.env`'s `ADMIN_PASSWORD`): confirm the bottom nav does NOT render on admin pages.
- Open `http://localhost:4321/login` (logged out): confirm the bottom nav still renders (public page).

- [ ] **Step 7: Commit**

```bash
git add src/components/sub_components/BottomNav.astro src/layouts/Layout.astro src/styles/global.css
git commit -m "$(cat <<'EOF'
Add persistent bottom nav (Props/My Bets/Leaderboard/Account)

Rendered once inside Layout.astro so every public page gets it
automatically; skipped on /admin routes. Exposes --bottom-nav-height so
other fixed elements (the bet-slip bar, next commit) can dock above it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Dock the bet-slip bar above the bottom nav

**Files:**
- Modify: `src/styles/global.css:384`

**Interfaces:**
- Consumes: `--bottom-nav-height` (from Task 4).
- Produces: no new interface — purely a positional CSS change.

- [ ] **Step 1: Change `.modal-div`'s offset**

In `src/styles/global.css`, change:

```css
.modal-div {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
}
```

to:

```css
.modal-div {
  position: fixed;
  bottom: var(--bottom-nav-height);
  left: 0;
  right: 0;
  z-index: 200;
}
```

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 3: Manually verify in the browser**

Open `http://localhost:4321/` (logged in):
- Confirm no picks selected → bottom nav is visible alone, nothing floating above it.
- Click "Over" or "Under" on any prop card → confirm the bet-slip summary bar ("X Picks · payout") now appears docked directly above the bottom nav, not overlapping it and not flush with the very bottom of the viewport.
- Click the summary bar to expand the full bet-slip modal → confirm it still opens correctly, still overlays the bottom nav (the full modal is a separate `.modal` element, unaffected by this change since it uses `inset: 0`, not `bottom`).
- Deselect all picks → confirm the summary bar hides and the bottom nav is the only thing visible again.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "$(cat <<'EOF'
Dock bet-slip summary bar above the bottom nav

The bar was pinned to bottom: 0, which would now overlap the persistent
bottom nav. It docks at --bottom-nav-height instead, purely via CSS — no
JS changes, since betSlip.js already toggles its visibility independently
of position.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
