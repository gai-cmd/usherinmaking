# usherinmaking renewal — admin + backend brief

Read `.moai/handoff/BRIEF.md` FIRST for stack, tokens, and business rules. This file adds what is
specific to the admin area and the API layer. Where the two conflict, this file wins for
`src/app/admin/**` and `src/app/api/**`.

## Admin design cards

Directory: `/private/tmp/claude-501/-Users-gai-personal-works-usherinmaking/4d92c96e-26ff-4fb5-bc77-5159d218fa74/scratchpad/cards/`

| Card | Screen |
|---|---|
| `admin-design-1a.html` | Dashboard |
| `admin-design-1b.html` | Photo ingest and curation |
| `admin-design-1c.html` | Inquiry INBOX |
| `admin-design-1d.html` | Plans and options editor |
| `admin-design-1e.html` | Taxonomy management, SEO / AEO |
| `admin-design-2a.html` | Journal (Naver blog import and editing) |
| `admin-design-2b.html` | Translation JA / EN / KO |
| `admin-design-2c.html` | Dress management |
| `admin-design-2d.html` | Settings — site information and consultation channels |
| `admin-design-2e.html` | Media library and activity log |

## Admin conventions

- **The admin UI is in Korean.** Content being edited stays in its original language.
- The admin lives at `/admin/*` — **outside the `[locale]` segment**, so it needs its own
  `src/app/admin/layout.tsx` rendering `<html lang="ko">` and `<body>`, importing `../globals.css`.
  There is no root `<html>` above it (the root layout is a pass-through).
- The admin is **`noindex` everywhere**: `export const metadata = { robots: { index: false, follow: false } }`
  in the admin layout.
- Reuse the design tokens from `globals.css`, but the admin is a denser working surface than the
  public site — tighter spacing and smaller type are correct here. It does not have to look like
  the marketing pages, and it should not use the arch motif.
- Admin pages are Server Components; extract `'use client'` islands only for the interactive parts
  (bulk-select grids, tab switches, editable tables, filter chips).

## Data layer — the seam

Prisma is **not installed yet** and there is no database connection. Do NOT add dependencies and do
NOT run `npm install`.

Instead, each domain gets a repository module under `src/server/` that exports async functions with
the signature the real implementation will have, reading from the seed modules in `src/content/`
for now:

```
src/server/photos.ts     listPhotos(), getPhoto(), updatePhotoStatus(), ...
src/server/inquiries.ts  listInquiries(), getInquiry(), updateInquiryStatus(), promoteToFaq(), ...
src/server/plans.ts      listPlans(), upsertPlan(), ...
```

Every function that would write must be **honestly stubbed**: mark the Prisma call site with a
clear `TODO(prisma)` comment and either return the unchanged input or throw a `NotImplementedError`
you define — **never pretend a write succeeded**. A screen whose write path is not wired must say so
in the UI rather than showing a fake success toast. The schema you are writing against is
`prisma/schema.prisma` at the repo root — read it; your function shapes and field names must match it,
so swapping the seed reads for Prisma calls is a drop-in.

`src/content/photos.ts` and `src/content/taxonomy.ts` are authored by another agent that is running
right now. Import from them by the shapes described in `prisma/schema.prisma`; if a file is not there
yet when you look, define the type you need locally in your own `src/server/` module and note the
mismatch in your report rather than writing into their files.

## API conventions

- Route handlers under `src/app/api/**/route.ts`, Node runtime.
- Validate every input with `zod` (already installed). Cap the length of every string field.
- Return status codes properly. Never echo a submitted payload back to the client.
- Admin API routes must check an auth guard before doing anything. There is no auth provider yet:
  implement `src/server/auth.ts` exporting `requireAdmin()` that reads a bearer token or session
  cookie and compares against `process.env.ADMIN_TOKEN`, returning a 401 when it fails. Mark it
  clearly as the interim mechanism. **Do not leave admin routes unguarded**, and do not hard-code a
  token value in the source.
- Nothing in the admin or the API may print a customer email address into a page that could be
  cached or indexed.

## Verification

Run `npx tsc --noEmit` from the repo root before reporting. Report its verbatim output, and separate
errors in your own files from errors in other agents' in-flight files.
