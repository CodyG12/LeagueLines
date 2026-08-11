# LeagueLines

A player-props betting app for friend groups — pick overs and unders on real
player stats, stack them into parlays, and see who actually knows sports.

> **No real money is ever involved.** LeagueLines is for fun only. Everyone
> starts with a balance of play-money "units," and every bet, payout, and
> leaderboard ranking is just units and bragging rights — never real
> currency, and never redeemable for anything.

## What it is

Think of it as a private sportsbook for your group chat. An admin posts
player-prop lines (e.g. "Cody — 24.5 Points"), and everyone else picks
Over/Under, either as single bets or stacked into a parlay for a bigger
payout multiplier. Bets settle when the admin grades the prop, units move
automatically, and a leaderboard tracks who's actually good at this.

## Features

**Betting**
- Browse player props by sport, or across all sports at once
- Single bets or multi-leg parlays (up to 10 legs), with a live payout
  multiplier as you build your slip
- A bottom-sheet bet slip with swipe-to-close and swipe-to-delete gestures
- Live/scheduled prop status, updated automatically once a prop's start
  time passes
- Bet history with live (pending) and past (settled) bets, with a win
  celebration (confetti + toast) the first time you see a new win

**Standings & achievements**
- A leaderboard with a podium for the top 3 (by net units, tie-broken on
  win rate), plus "Biggest Upset" and "Worst Beat" callouts for the week
  or the season
- Win/loss streak indicators
- Unlockable badges (First Blood, On Fire, Giant Killer, High Roller, Iron
  Stomach, Veteran) with progress tracking toward the ones you haven't
  earned yet

**Accounts**
- Sign up / log in with a username and password (sessions via signed,
  HTTP-only cookies — no third-party auth)
- Upload a real profile photo, or pick one of six mascot avatars
- A starting balance of units, topped up by winning bets

**Admin**
- A password-gated admin panel (separate from user accounts) for creating,
  editing, and grading player props
- Sport, player, and stat dropdowns that grow as you use them — add a new
  option on the fly, or delete ones you don't need anymore
- Stats are scoped per sport, so the Stat dropdown only shows options that
  make sense for whichever sport is selected
- A "seed random props" tool for quickly populating test data

**Installable app (PWA)**
- Installable to the home screen on both iOS and Android, with an offline-
  capable service worker
- A custom install prompt on Android/desktop Chrome, and a dismissible
  "Add to Home Screen" instructional banner on iOS Safari

## Tech stack

- **[Astro](https://astro.build)** (server-rendered, deployed on Vercel) for
  pages and routing
- **React** islands for the few genuinely stateful, interactive widgets
  (standings board, badges) — everything else is server-rendered HTML with
  small vanilla TypeScript/JavaScript sprinkled on top
- **MongoDB** for data (users, bets, player props, standings-relevant
  option lists)
- **Vercel Blob** for uploaded profile photos
- **@vite-pwa/astro** / Workbox for the installable-app/offline layer
- Three.js / OGL-powered animated backgrounds (Beams, GradientBlinds,
  Lightfall) for the site's visual identity

## Getting started

You'll need a MongoDB connection string and a Vercel Blob token. Create a
`.env` file in the project root:

```
MONGODB_URI=your-mongodb-connection-string
ADMIN_PASSWORD=a-password-for-the-admin-panel
SESSION_SECRET=a-long-random-string
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

Then:

```sh
npm install
npm run dev       # start the dev server at localhost:4321
npm run build     # type-check + production build
npm run preview   # note: not supported with the Vercel adapter — use
                   # `vercel dev` or a deployed preview URL instead
```

## Design system

All font, color, spacing, and aesthetic decisions live in
[`DESIGN.md`](./DESIGN.md) — read it before making visual changes. The
short version: dark-first, restrained color use (gold reserved for
money/action, purple reserved for live-game state), General Sans for
headings, Instrument Sans for body copy, and Geist with tabular numerals
for every number on the site.
