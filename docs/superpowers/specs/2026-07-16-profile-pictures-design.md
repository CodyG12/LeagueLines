# Profile Pictures on Player Props — Design

## Problem

New users can't attach a profile picture to their account, and player props have no
concept of a picture at all — "player" is just a free-text string, unrelated to the
`users` collection created at signup. The goal: let users upload a profile picture at
signup, let admins link a prop's "player" to a registered user, and show that user's
photo centered on the player prop card.

## Decisions

- **Player ↔ user link**: `player` on a prop can now optionally reference a registered
  user (`playerUserId`). Both modes stay supported — admin can pick a registered user
  *or* type a free-text name (e.g. someone without an account yet), exactly as today.
- **Photo upload**: optional at signup. Users who skip it get a default placeholder
  avatar wherever their picture would otherwise show.
- **Storage**: Vercel Blob (`@vercel/blob`). The app has no existing file-storage
  service, and the user's target host is Vercel — a serverless platform with an
  ephemeral, non-shared filesystem, so local disk storage would silently lose
  uploaded files between requests. Vercel Blob is Vercel's native object storage
  and needs no separate account/service beyond the existing Vercel project.
- **Admin form UX**: single merged `<select>` — the existing player dropdown gains a
  "Registered Users" optgroup above the existing free-text options, rather than a
  second field or a mode toggle. Smallest change, reuses the pattern the form
  already uses for sport/stat.
- **Card layout**: every player prop card gets a circular avatar centered above the
  player name — registered users show their photo (or the default placeholder if
  they skipped upload), free-text players always show the default placeholder. Every
  card stays visually consistent; there's no card with an avatar slot and one
  without.

## Explicitly out of scope (YAGNI)

- Editing/replacing your avatar after signup (an account settings page doesn't exist
  yet and isn't required for this feature).
- Fuzzy-matching free-text player names to existing accounts — linking is always an
  explicit admin choice.
- Switching the deploy adapter (`@astrojs/node` → `@astrojs/vercel`). That's a
  separate deployment concern; Vercel Blob works independent of which Astro adapter
  is running, though the adapter will need to change before this app can actually
  run *on* Vercel. Not required to build this feature.

## Data model changes

`src/lib/users.ts`:
- `UserDoc.avatarUrl: string | null`
- `PublicUser.avatarUrl: string | null`
- New `listAllUsers(): Promise<PublicUser[]>` (for populating the admin form's user
  optgroup).

`src/lib/props.ts`:
- `PlayerPropDoc.playerUserId: ObjectId | null`
- `PublicPlayerProp.playerUserId: string | null`
- `PublicPlayerProp.playerAvatarUrl: string | null` (derived, not stored — resolved
  at read time)
- `CreatePropInput`/`UpdatePropInput` gain `playerUserId?: string | null`.

## New module: `src/lib/avatarStorage.ts`

```
uploadAvatar(file: File, userId: string): Promise<string>
```
- Wraps `@vercel/blob`'s `put()`. Path: `avatars/<userId>-<timestamp>.<ext>`,
  `access: "public"`.
- Requires `BLOB_READ_WRITE_TOKEN` env var — throws a clear error if missing,
  matching the existing `SESSION_SECRET`/`ADMIN_PASSWORD` pattern in
  `src/lib/adminAuth.ts`.
- Validates content type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) and
  size (max 5MB) before uploading. Throws a typed error the caller can map to a
  specific signup error code.

## Signup flow

`src/pages/signup.astro`:
- Form gains `enctype="multipart/form-data"` and an optional
  `<input type="file" id="avatar" name="avatar" accept="image/*" />`.

`src/pages/api/auth/signup.ts`:
- Reads `avatar` from `formData()`. If present and non-empty, validates + uploads via
  `avatarStorage.uploadAvatar`; on validation failure, redirects back to
  `/signup?error=invalid-avatar-type` or `?error=avatar-too-large` (new error codes,
  same pattern as the existing `duplicate`/`missing-fields`/etc. codes) — the whole
  signup fails clearly rather than silently dropping the photo. If absent, the new
  user is created with `avatarUrl: null`.

## Admin prop form

`src/pages/admin/props.astro`:
- Also loads `listAllUsers()`.
- Player `<select>` gets a new `<optgroup label="Registered Users">` above the
  existing free-text optgroup, options valued `user:<id>`, labeled
  `First Last (@username)`.

`src/scripts/adminProps.js`:
- On submit: if the selected player value starts with `user:`, parse the id, send
  `playerUserId` plus the option's display text as `player`. Otherwise: unchanged
  behavior — free-text `player`, `playerUserId: null`.
- `populateFormForEdit`: if `prop.playerUserId` is set, preselect the matching
  `user:<id>` option instead of the plain string value.

`src/pages/api/admin/props/index.ts` and `[id].ts`:
- Accept optional `playerUserId` in the request body. If present, validate it's a
  well-formed ObjectId and that the user exists (400 if not); pass through to
  `createProp`/`updateProp`.

## Card rendering

`src/lib/props.ts`:
- `listPublicProps`, `listPublicPropsBySport`, `listAllProps`, and `getPropById` all
  batch-resolve `playerAvatarUrl`: collect the distinct non-null `playerUserId`s in
  the result set, one `users.find({ _id: { $in: [...] } })` query, merge avatar URLs
  into the public props. No N+1 queries.

`src/components/Home.astro` and `src/pages/admin/props.astro`:
- Add `<img class="prop-avatar" src={prop.playerAvatarUrl ?? "/avatar-placeholder.svg"} alt="" />`
  centered above the player name in both the public prop card and the admin prop
  card.

New static asset: `public/avatar-placeholder.svg` — a simple generic user-silhouette
icon styled to the existing palette (`--secondary-bg` fill, `--secondary-text`
icon), so it reads as an intentional empty state rather than a broken image.

New CSS (`src/styles/global.css`):
```css
.prop-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  margin: 0 auto var(--space-3);
  border: 2px solid rgba(255, 255, 255, 0.08);
  background-color: var(--secondary-bg);
}
```

## Error handling

- Missing `BLOB_READ_WRITE_TOKEN`: fail loudly and immediately on first upload
  attempt, same posture as the existing required-env-var checks.
- Invalid avatar file at signup: signup fails with a specific, user-visible error;
  it does not silently create the account without a photo.
- `playerUserId` referencing a nonexistent user in the admin API: 400, same
  validation posture as the rest of `/api/admin/props`.
- Users can't currently be deleted (no delete endpoint), so a prop's
  `playerUserId` can't dangle — not handled as a special case.

## Testing / verification

- `astro check` for type correctness across the new fields.
- Manual QA (dev server + browser):
  - Sign up with a photo → user doc has `avatarUrl`, photo appears wherever a prop
    links to that user.
  - Sign up without a photo → `avatarUrl: null`, placeholder shown.
  - Admin: create a prop linked to a registered user → avatar shows on both the
    public card (`/leagues/:sport`) and the admin card (`/admin/props`).
  - Admin: create a prop with a free-text player → placeholder shown on both cards.
  - Admin: edit an existing user-linked prop → the user optgroup option is
    preselected correctly.
