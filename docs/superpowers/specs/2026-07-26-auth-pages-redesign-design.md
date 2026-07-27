# Auth Pages Redesign — Design

## Problem

`/login`, `/signup`, and `/admin/login` currently share `.admin-login`/`.admin-form` —
plain stacked `<label>`/`<input>` lists on a flat black background, styled purely
functionally with no relationship to the rest of the app's visual identity. The user
wants these three pages to pick up the "vibe" of two references (a Dribbble shot —
dark cards, pill-shaped icon-prefixed inputs, solid pill CTA, "or continue with"
divider, outlined secondary buttons — and PrizePicks' real login screen, which reads
similarly: dark, minimal, rounded-pill inputs) while staying inside our own design
system rather than adopting either reference's literal colors or unbuilt features.

`.admin-form` is also used by the admin panel's "New Prop" creation form
(`src/pages/admin/props.astro`), so it can't simply be redefined — that form must be
untouched.

## Decisions

- **New dedicated CSS classes**, not a redefinition of `.admin-form`/`.admin-login`.
  New rules (`.auth-*`, see below) are additive in `global.css`; the existing
  `.admin-form`/`.admin-login`/`.field`/`.field-row` rules are left exactly as they
  are today, so the admin "New Prop" form is unaffected.
- **Page shell**: each of the three pages wraps its content in the same
  `.page-bg.beams-page-bg` + `<Beams />` background used today by `Home.astro` and
  `my-bets.astro` (not `Landing.astro`'s `GradientBlinds`, which is a hero-section
  effect tied to that section's own layout/props, not a general-purpose page
  background). This is the established "regular page with animated background"
  pattern already used sitewide — reusing it here is more consistent than adding a
  fourth WebGL usage with new prop tuning.
- **Minimal top area**: just the `LeagueLines` wordmark (reusing the existing
  `.site-brand`/`.site-brand-league`/`.site-brand-lines` markup/classes from
  `Nav.astro` for identical styling), linking to `/`. Not the full `<Nav />`/`<Header
  />` — showing sport-league tabs or Log In/Sign Up buttons on the login page itself
  would be redundant/confusing.
- **Card**: `.auth-card` — a frosted glass panel (`background: rgba(255,255,255,0.1);
  backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.1);`), same
  frosted treatment as the player-prop card's `.pc-user-info` bar, `border-radius:
  var(--radius-lg)`, centered, `max-width: 420px`. Floats over the Beams background
  instead of a flat solid card, so the background art stays visible.
- **Inputs**: `.auth-input-wrap` is a pill (`border-radius: var(--radius-pill)`)
  containing a leading icon (`.auth-input-icon`, small inline stroke SVG, matching the
  hand-written-SVG convention already used for sport icons/bottom nav — no icon
  library) and the `<input>` itself (`background: transparent; border: none;` so the
  pill wrapper supplies the visual chrome). Icon choice: person/user icon for
  name/username fields, lock icon for password fields. The existing small label above
  each field is kept (both accessible and present, subtly, in the Dribbble reference
  too) — only the input's shape/chrome changes, not the label pattern.
- **Buttons**: no new button styles needed. The sitewide `button` rule is already a
  solid Trophy Gold pill (`background-color: var(--highlight-color); border-radius:
  var(--radius-pill);`). `.auth-form button[type="submit"]` just adds `width: 100%;`
  and slightly larger vertical padding for prominence as the page's single primary
  action.
- **Bottom link** (`Need an account? Sign up`, `Already have an account? Log in`):
  centered text below `.auth-card`, using the existing global `a` link color
  (`--highlight-color`, i.e. Trophy Gold) — no new color needed, just layout.
- **Error messages**: `.auth-error` — same red (`--danger-color`) as today's
  `.form-error`, but wrapped in a soft tinted pill/banner (`background:
  rgba(255,69,58,0.12); border-radius: var(--radius-sm); padding: var(--space-2)
  var(--space-3);`) instead of bare text, so it reads as part of the polished card.
  `.form-error` itself is untouched (still used elsewhere, e.g. admin props form) —
  `signup.astro`/`login.astro`/`admin/login.astro` switch their error `<p>` to
  `class="auth-error"` instead.
- **Signup's avatar section unchanged functionally**: file upload input + mascot
  sprite radio grid stay exactly as they work today (same fields, same
  `sprite-picker-grid`/`sprite-option` classes/behavior). Only wrapped in the new
  `.auth-card` context and given consistent spacing — e.g. a small `.auth-section-
  label` style for "Or pick an avatar (optional)" matching the new card's type scale.
  No visual redesign of the sprite grid itself; it already fits the app's existing
  pill/circle avatar language.
- **Admin login**: same `.auth-page`/`.auth-card`/`.auth-input-wrap`/button treatment,
  single password field (lock icon), no avatar section, no bottom "sign up" link
  (admin has no self-serve signup) — title reads "Admin Login" as it does today.
- **`firstName`/`lastName` row on signup**: keeps today's existing `.field-row` 2-
  column grid (already responsive, collapses to 1 column under 640px) — just the
  inputs inside it switch to the new pill/icon style.

## Explicitly out of scope (YAGNI)

- Social login buttons ("Continue with Google/Apple") in any form — not shown, not
  disabled/stubbed. No OAuth backend exists and none is being added here.
- "Remember me" checkbox — no session-length toggle exists in `userAuth.ts` today;
  not introducing one.
- "Forgot password?" link — no password-reset flow exists anywhere in the app; not
  adding a link that leads nowhere.
- Any change to `.admin-form`, `.admin-login`, `.field`, `.field-row`, or the admin
  "New Prop" form that uses them.
- Any change to `login.ts`/`signup.ts`/admin login API routes, `userAuth.ts`, session
  cookie logic, or validation rules — this is markup + CSS only. Error *conditions*
  and redirect params are unchanged; only how the resulting message is styled.
- Changing the sprite picker grid's own visual design — it's restyled by inheriting
  the new card's spacing/type scale, not redesigned.
- A new icon library dependency — hand-written inline SVGs only, matching the
  existing sitewide convention.

## Files touched

- `src/pages/login.astro` — new markup structure (`.auth-page` wrapper, `<Beams />`,
  wordmark, `.auth-card`, `.auth-form`, `.auth-input-wrap` per field, `.auth-error`).
- `src/pages/signup.astro` — same shell; keeps existing avatar upload/sprite-picker
  fields and all `error === "..."` branches, restyled onto `.auth-error`.
- `src/pages/admin/login.astro` — same shell, single password field, no avatar
  section/signup link.
- `src/styles/global.css` — new rules only, nothing existing removed/redefined:
  `.auth-page`, `.auth-card`, `.auth-brand` (or reuse `.site-brand` directly),
  `.auth-form`, `.auth-field` (label + input-wrap stack), `.auth-input-wrap`,
  `.auth-input-icon`, `.auth-error`, `.auth-footer-link`, `.auth-section-label`.

## Implementation notes

- `Beams` props copied from `my-bets.astro`'s exact usage (`beamWidth={2}
  beamHeight={15} beamNumber={12} lightColor="#7c5cfc" secondaryLightColor="#d4a72c"
  speed={2} noiseIntensity={1.75} scale={0.2} rotation={0}
  backgroundColor="#050506"`) for visual consistency with the rest of the logged-in
  app — no new color tuning.
- Person icon and lock icon are new small inline SVGs (`viewBox="0 0 24 24"`,
  `stroke="currentColor"`, rounded caps) sized ~16–18px inside the input pill,
  written directly in each `.astro` file per field (three files, two icons total —
  doesn't warrant extracting a shared icon module for this small a set).
- `admin/login.astro`, `login.astro`, and `signup.astro` each remain independent
  Astro files (no new shared layout/component extracted for the card shell) — the
  markup is small and duplicated three times already fits this codebase's existing
  pattern of independent page files with shared CSS classes (see `player-prop`/
  `admin-prop` cards, which duplicate markup across `Home.astro`/`admin/props.astro`
  rather than sharing a component).
