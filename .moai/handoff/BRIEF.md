# usherinmaking renewal — shared implementation brief

Read this fully before writing code. Every agent shares it.

## Project

- Repo root: `/Users/gai/personal/works/usherinmaking`
- Branch: `feat/renewal-nextjs`
- Stack: **Next.js 15 App Router + TypeScript + CSS Modules**. No Tailwind. No UI library.
- Deps already installed (`next@15.5.4`, `react@19.1.1`, `zod`). Do NOT add dependencies.
- Old static site is archived under `legacy/` — do not touch it, do not import from it.
- Alias `@/*` → `./src/*`.

## Design source of truth

Design handoff cards are pre-split, one HTML file per screen, at:
`/private/tmp/claude-501/-Users-gai-personal-works-usherinmaking/4d92c96e-26ff-4fb5-bc77-5159d218fa74/scratchpad/cards/`

`INDEX.md` in that directory maps file → source → label.
Read the card files for **your assigned pages only** (desktop card + mobile card + each locale).
These are **high-fidelity**: colours, type, spacing and copy are final. Reproduce them.
The `dv-*` classes and the `dv-opt` / `dv-olabel` wrapper are review chrome — NOT part of the page.

Copy inside the cards is the **final approved copy for that language**. Transcribe it verbatim.
JA / EN / KO are independent bodies of text — never machine-translate one into another; take each
locale's copy from that locale's own card.

## Already built (reuse, do not duplicate)

- `src/lib/i18n.ts` — `Locale`, `LOCALES`, `path(locale, pageKey, ...rest)`, `NAV`, `UI`, `alternates()`, `SITE_URL`
- `src/app/globals.css` — design tokens + utility classes: `u-wrap` `u-section` `u-section--alt`
  `u-display` `u-h2` `u-lead` `u-body` `u-label` `u-meta` `u-num` `u-btn` `u-btn-dark` `u-btn-ghost`
  `u-link` `u-arch` `u-arch-lg` `u-visually-hidden`
- `src/app/[locale]/layout.tsx` — renders `<html lang>`, Header, Footer. Your page renders **only its own body**.
- `src/components/Header.tsx`, `Footer.tsx`, `Section.tsx`, `ContactCta.tsx`, `PlanCard.tsx` (+ `.module.css` each)
- `src/content/site.ts` — `STUDIO_SETS`, `STUDIO_PLANS`, `LOCATION_PLANS`, `ANNIVERSARY_PLANS`,
  `STUDIO_OPTIONS`, `LOCATION_NOTES`, `CHANNELS`, `STUDIO_INFO`, `TBC`

Import plan/price/set data from `@/content/site` — never re-hardcode prices in a page.
If your page needs page-specific copy that no one else uses, put it in a local `content.ts`
next to the page (e.g. `src/app/[locale]/studio/content.ts`), keyed by locale.

## File ownership — write ONLY inside your assigned paths

Concurrent agents are running. Writing outside your paths will collide.
If you need a shared change, note it in your final report instead of making it.

## Design tokens (already in globals.css — use the CSS variables, never raw hex)

```
--bg #FAF8F4   --bg-alt #F4F1EA   (backgrounds: only these two)
--text #2E2A25 --text-body #3F3A33 --muted #5F584E --muted-2 #6F685C
--brass #8A6A3F --hairline #E2DDD3 --hairline-2 #ECE7DD --placeholder #E6E1D6 --dark #2E2A25
```

- Fonts resolve automatically per `<html lang>`: `--ff-heading` / `--ff-body`.
  Latin display = Cormorant Garamond, latin UI = Jost. **EN never uses a serif body.**
- **Money and numbers always use `--ff-num` (Jost)** — apply the `u-num` class.
- Arch mask is the brand motif: `border-radius: 140px 140px 0 0` desktop set cards,
  `200px 200px 0 0` location category cards, `75-120px` on mobile. Everything else is square.
- **No box-shadows anywhere.** Separation is a 1px hairline.
- Transitions 180-240ms ease, limited to link underlines and button inversion.
- Breakpoints: 375 / 768 / 1024 / 1280+. Desktop cards are drawn at 1200px, mobile at 375px.
- Section padding: desktop 56-74px block, mobile 30px. Gutters: desktop 54px, mobile 18px
  (already the `--gutter` / `--section-y` variables).
- Every tap target on mobile at least 44px. Add `data-tap` to links/buttons that need it.

## Hard business rules (violating these is a defect)

1. Brand is one word, lowercase: **usherinmaking**. Header/footer/OG use the logo image, not text.
2. Two equal axes: **LOCATION (outdoor)** and **STUDIO (indoor)**, completely separate.
   Never write "if it rains we move to the studio" or any equivalent.
3. LOCATION is organised by **shoot category, not region**: WEDDING / ANNIVERSARY.
4. **No automatic or calendar booking exists.** Everything is confirmed by conversation after an
   enquiry. There is no RESERVE page — PHOTOGRAPHER took its place.
5. **No Instagram embeds or outlinks.** All photography is served from our own domain.
6. Dress page has **no brand names** — collections only.
7. Do not assert unsourced numbers or facts. Anything unconfirmed renders as the `TBC` token from
   `@/content/site`.
8. Confirmed prices only: studio plans 99,000 / 150,000 / 66,000 / 25,000 yen (monitor price, **no**
   tax-included label); location 76,000 / 100,000 / 128,000 yen (tax included);
   anniversary 38,000 / 60,000 yen (tax included).
9. Consultation channels by language: **KO = KakaoTalk first**, **JA = LINE first**, **EN = enquiry form / email**.
   Instagram is a secondary channel everywhere. **Never print an email address.**
10. The Naver-blog notice appears on **Korean pages only**.
11. Punctuation: EN pages must not contain Japanese middle dots, full-width slashes, wave dashes or
    full-width spaces. KO pages must not contain a full-width plus sign — use ASCII `+`, `·`, `/`.

## SEO / AEO requirements for every page you build

- A **definition-style opening paragraph** (question then answer shape) as real text near the top of
  the body, not inside an image. This is the primary AI-citation surface.
- `export const metadata` (or `generateMetadata`) with title, description, `alternates.canonical`
  and `alternates.languages` — build languages with `alternates(pageKey, ...rest)` from `@/lib/i18n`.
- Structured data via a `<script type="application/ld+json">` tag where the page warrants it
  (`LocalBusiness`, `Service`, `ImageObject`, `FAQPage`, `BreadcrumbList`).
- Images: `next/image` with explicit `width`/`height` (or `fill` plus a sized parent). Hero images
  `priority`; everything else lazy by default. Meaningful `alt` in the page's own language.

## Page conventions

- Pages are **Server Components** by default. Add `'use client'` only where interaction demands it
  (tabs, filters, forms, carousels) and keep the client component as small as possible.
- Next 15: `params` and `searchParams` are Promises. Use `const { locale } = await params;`
- Validate the locale: `if (!isLocale(locale)) notFound();`
- `export function generateStaticParams()` returning `LOCALES.map(locale => ({ locale }))`.
- End content pages with `<ContactCta locale={locale} />` where the design shows a CONTACT block.
- Code comments in Korean, short, explaining *why* — matching the existing files' style.

## Verification before you report done

Run from the repo root and make sure your files are clean:

```
npx tsc --noEmit
```

Report the actual command output. Do not claim it passed without running it.
Type errors originating from another agent's in-flight files are not yours — say so explicitly
and list which of the reported errors are in your own paths.
