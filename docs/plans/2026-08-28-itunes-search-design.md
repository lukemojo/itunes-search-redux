# iTunes Search — Design

**Date:** 2026-08-28
**Status:** Draft — a finalised design + report follows review.

## Context

One repository containing two implementations of the same product: an iTunes music
search application. The primary app uses React, TypeScript, Redux (Toolkit), Redux
Thunk, and NodeJS + Express static serving. A second app implements the same product
in Modern.js, demonstrating how the architecture translates to that framework. The
root README frames both apps and the relationship between them.

## Requirements

- Search for an artist, album or song; see results matching Artists, Albums, and/or Songs.
- Limit to 10 items at a time; scrolling down reveals another 10.
- Empty result set → user is notified there are no results.
- The iTunes Search API is CORS-blocked in browsers → calls go through Node/Express.
- Semantic, well-structured markup; unit testing throughout.
- Self-imposed: built for deployment — both apps live on public URLs, with CI green
  on the repo. A running product demonstrates more than a zip of source.
- Self-imposed: production-ready as a lasting portfolio piece — hardened server,
  dependencies kept current automatically, and an explicit sign-off checklist at
  the end. It should be safe to leave up and easy to keep progressing.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo shape | One repo, two apps | The Redux/Express app is the primary implementation; the Modern.js app sits alongside it. Root README explains both. |
| Redux flavour | Redux Toolkit | `createAsyncThunk` is redux-thunk under the hood (README notes this). Current best practice, less boilerplate, easier to test. |
| Styling | styled-components + semantic HTML | Hand-rolled semantic elements keep the markup fully owned and readable; styled-components for presentation. No component-library div soup. |
| Search architecture | ~~Express BFF merges; client reveals~~ BFF merges; client fetches incrementally + reveals | One endpoint fans out to iTunes, normalizes, merges. ~~Client fetches once per search, reveals 10 at a time. Avoids iTunes' flaky `offset`.~~ **Revised 2026-08-31:** client fetches in growing batches (per-entity limit 20 → 40 → 60…) and reveals 10 at a time between fetches — see *Paging revision* below. Mirrors Modern.js's BFF concept. |
| Test runner | Vitest | Native to a Vite app; Jest-compatible API so the testing approach is identical. |
| Result rows | Kind badge shown | Each row displays its type (Artist / Album / Song) alongside the title. |
| Deployment | Render web services, via `render.yaml` Blueprint | Free tier, no card, deploys straight from GitHub. Each app is one Node web service; the Blueprint keeps the config in the repo (infra-as-code, reviewable). |
| CI | GitHub Actions | Typecheck, lint, format check, tests and build on every push — green checks visible on the repo. |

## Paging revision (2026-08-31)

The original design fetched 3×50 up front and paged purely client-side, citing
iTunes' "flaky offset". We revisited this wanting real network data loading —
and probed the API first:

- **`offset` is non-functional, not flaky**: across 4 term×entity combinations,
  `offset=10` returned the identical page as `offset=0` (10/10 overlap, every
  time). Upstream pagination is impossible.
- **Ordering is not stable across limits**: a `limit=30` response does not match
  the concatenation of smaller-limit responses, so refetching at a bigger limit
  can reshuffle items.
- Same-query responses are CDN-cached and byte-stable on refetch, so repeat
  calls at a grown limit are cheap upstream.

**Decision — hybrid fetch-and-reveal:**

- Client calls `GET /api/search?term=x` ~~`&limit=20`~~, reveals 10 merged
  items per scroll, and when the reveal window nears the end of loaded data,
  prefetches the next batch (per-entity limit 20 → 40 → 60, capped at iTunes'
  max of 200) — by echoing the server's opaque `cursor` (see addendum below).
- Step 20 (not 10) because each merged fetch is 3 upstream calls and iTunes
  rate-limits at ~20 calls/minute; the 10-item headroom between fetch and reveal
  makes prefetch invisible.
- **Append-only merge by id in the client**: because ordering shifts between
  limits, the reducer never replaces the list — it keeps existing items fixed
  and appends only unseen ids. (De-dupe returns, client-side, with a
  demonstrated reason to exist.)
- `SearchResponse` becomes `{ results, hasMore, next? }` — a global total is
  unknowable; `hasMore` = some entity returned a full page and the cap isn't hit.
- Conscious trade-off: a fetch at limit N re-downloads the first N−20 items
  upstream; accepted because responses are CDN-cached and N caps at 200.

**Addendum (2026-08-31): server-managed limits via signed cursors.** The first
cut exposed `?limit=` directly, which lets anyone jump straight to an immediate
3×200 fetch. Decision: the limit never appears in the public API. Each response
with `hasMore` carries `next` — an opaque HMAC-signed token (Node `crypto`,
per-boot secret) encoding the next per-entity limit. Load-more echoes it back
as `?cursor=`; the server verifies the signature and uses the limit *it*
embedded, so a fabricated or tampered cursor is a 400 and a fresh client always
starts at 20. Paging policy (start, step, cap) is 100% server-owned. Per-boot
secret means cursors die on restart/deploy; the client degrades gracefully — a
failed load-more keeps what's shown and stops paging (no retry loop). Fast
scrolling to 200 via genuine progression remains an accepted risk (public data,
bounded cost; rate limiting stays a documented omission).

## Repo layout

```
next/                          ← the single git repository
├── README.md                  ← framing: the two apps and how they relate
├── next-technical-test-redux/ ← primary app
│   ├── src/
│   │   ├── client/            ← React + TS + Redux app (Vite)
│   │   ├── server/            ← Express: BFF /api/search + static serving
│   │   └── shared/            ← types shared by client and server
│   └── package.json           ← single package: dev / build / start / test
└── next-technical-test/       ← Modern.js app (scaffold exists)
```

Tooling: Vite client (dev proxy `/api` → Express; prod build served BY Express so
pages are statically served by NodeJS + Express). `tsx` runs the TS server in dev;
`tsc` build so `pnpm start` is plain Node. pnpm as the package manager (pinned via
`packageManager`; matches the Modern.js app). Single package — no workspaces ceremony.

## Express server

```
src/server/
├── index.ts          ← bootstrap only: createApp().listen(PORT)
├── app.ts            ← createApp(): static + /api wiring (supertest target)
├── routes/search.ts  ← GET /api/search?term=...
└── itunes.ts         ← iTunes client + merge logic (pure, injectable fetch)
```

- `GET /api/search?term=x[&cursor=…]` → three parallel iTunes calls
  (`entity=musicArtist`, `album`, `song`, the server-decided `limit` each) → normalize
  into a discriminated union
  `{ kind: 'artist' | 'album' | 'song', id, title, subtitle, artworkUrl?, ... }`
  → ~~interleave by kind (artist, album, song, artist, …) so every page
  shows a mix~~ → `{ results, hasMore, next? }`. ~~`limit=50` each → `{ results, total }`~~
  (revised — see *Paging revision*). (Interleaving dropped in the 2026-09-01
  UI pass: results now keep entity-group order — artists, then albums, then
  songs — which reads better in the redesigned layout, and after the client's
  append-only merge the displayed order is client-owned anyway, so the server
  round-robin was logic serving a presentational choice it no longer served.) (Server-side de-dupe was considered and
  dropped: entity-scoped searches were verified not to duplicate ids within a
  call, and kind-prefixed ids can't collide across calls. De-duping across
  refetches at growing limits is the client reducer's job.)
- Missing/empty `term` → 400; ~~`limit` optional (default 20), non-numeric or
  out of range 1–200 → 400~~ `cursor` optional (absent = first page at limit
  20), invalid signature → 400 (see *Paging revision addendum*). Upstream
  failure → 502 with clean error body.
- No CORS hacks: the browser only talks to our origin.
- `express.static(clientDist)` + index fallback serves the built app.
- Normalize/merge are pure functions — unit-tested without HTTP.

## Redux client

```
src/client/
├── main.tsx                 ← store + <Provider> + mount
├── App.tsx
├── store/
│   ├── index.ts             ← configureStore, RootState/AppDispatch types
│   └── searchSlice.ts       ← whole feature state
├── components/
│   ├── SearchForm.tsx       ← <form role="search">, debounced input (no button)
│   ├── SearchResults.tsx    ← <ul> + sentinel + status messages
│   └── ResultCard.tsx       ← <li>: artwork, kind badge, title, subtitle
└── hooks/
    └── useInfiniteReveal.ts ← IntersectionObserver on sentinel
```

State shape (revised 2026-08-31 — see *Paging revision*; `limit`/`hasMore`
added, `loadingMore` status added, `results` is append-only):

```ts
{
  term: string,
  status: 'idle' | 'loading' | 'loadingMore' | 'succeeded' | 'failed',
  results: SearchResult[],   // loaded so far, append-only merged by id
  visibleCount: number,      // starts at 10
  next?: string,             // opaque server cursor for the next batch
  hasMore: boolean,          // server says more may exist upstream
  loadMoreRequestId?: string, // in-flight loadMore (2026-09-01 — stale-settle guard)
  error?: string
}
```

- `searchItunes = createAsyncThunk(...)` calls `/api/search?term` via the
  redux-thunk middleware. `pending` resets results, cursor and visibleCount=10;
  `fulfilled` stores results, `hasMore` and `next`; `rejected` errors. Both
  settle-handlers drop stale responses whose `meta.arg` no longer matches the
  current term (debounced typing overlaps requests; last-pending wins).
- Search-as-you-type (added 2026-08-31): the form debounces input — a search
  fires 400ms after typing pauses (min 2 chars); ~~submit/~~Enter searches
  immediately with no minimum. A last-searched ref stops the armed timer from
  duplicating ~~a submit~~ an Enter search and identical terms from refiring.
  (The visible Search button was removed in the 2026-09-01 UI pass —
  search-as-you-type makes it redundant. The form keeps an `onSubmit` handler
  regardless: Enter still submits a button-less form, and without
  `preventDefault` the native submit reloads the page and wipes state; it is
  also the only way to search sub-minimum-length terms. The last-searched ref
  is cleared when a search fails — 2026-09-01 review finding — so the same term
  can be retried instead of the guards trapping the user on the error screen.)
- `loadMore = createAsyncThunk(...)` refetches echoing the stored `next`
  cursor; `fulfilled` merges append-only by id (never replaces — upstream
  ordering shifts between limits) and stores the new `hasMore`/`next`. A
  condition guard prevents duplicate in-flight loads. A failed loadMore keeps
  the shown results and stops paging (no retry loop). Settle-handlers are
  requestId-guarded (2026-09-01, review finding): only the in-flight loadMore
  may settle, so a slow batch superseded by a new search — or by a newer
  loadMore — can't append the old term's results or clobber the cursor after
  the list was reset.
- `revealMore` reducer: `visibleCount += 10`, capped at `results.length`.
- `clearSearch` reducer (added 2026-09-01): emptying the input resets the slice
  to its initial state — results, paging and error all cleared, and the form's
  last-searched ref reset so retyping the same term searches again. In-flight
  responses that land afterwards are dropped by the existing stale guards
  (term mismatch for searches, requestId for loadMore).
- Selectors: `selectVisibleResults`, `selectHasMore` (unrevealed loaded items
  remain, or upstream has more), `selectShouldLoadMore` (reveal window nears end
  of loaded data and server `hasMore`), `selectStatus`.
- `useInfiniteReveal`: IntersectionObserver on a sentinel rendered only while
  more can be revealed or loaded; on intersect, dispatch `revealMore`, and
  prefetch `loadMore` when the window nears the end. No scroll math, no
  listener churn. `rootMargin: '200px 0px'` is load-bearing (2026-08-31): a
  zero-height sentinel that is the last element on the page sits exactly on
  the viewport's bottom boundary at max scroll and never strictly enters it —
  Chrome then reports it non-intersecting and reveals stall after one page
  (found in a real browser; invisible to jsdom's mocked observer).
- Accessibility revision (2026-09-01, from a dedicated WCAG review): a visible
  **"Load more" button** renders alongside the sentinel (both gated on
  `hasMore`) — scroll-to-reveal alone is unreachable for keyboard and
  screen-reader users, and the page-level scroller is `overflow:hidden`. The
  per-branch status paragraphs were replaced by a single persistent
  `role="status"` region that announces the lifecycle: "Searching…", "No
  results found for '{term}'", and a result count — "Showing N of more than N
  results for '{term}'" while more exist (locally or upstream), collapsing to
  "Showing N of N" once everything is revealed and upstream is exhausted.
  Explicit `role="list"` on the results `ul` (Safari/VoiceOver drops list
  semantics from `list-style: none` lists); error colour moved to a theme
  token.
- Required states in markup: `<ul aria-label="Search results">`; ~~"No results
  found for '{term}'" in `role="status"` / `aria-live="polite"`; errors and
  loading likewise~~ status/no-results/count announcements via the persistent
  status region above; errors in `role="alert"`.
- Presentation (2026-09-01 UI pass): styled-components `ThemeProvider` with a
  token theme (`styles/theme.ts` + `styled-components.d.ts` module
  augmentation), `GlobalStyle` rendered inside it; app shell is a grid of
  header, side nav and scrollable main. Results with no iTunes artwork fall
  back to per-kind placeholder images (`public/images/blank-*.png` — Vite
  serves `public/` at the root in dev and copies it into `dist/client` for
  Express in prod).

## Testing (Vitest throughout)

1. **Pure logic** — normalize~~/interleave~~; slice reducers and selectors
   (reset on new search, revealMore capping, append-only merge by id on
   loadMore, error state). Bulk of coverage.
2. **BFF route** — supertest vs `createApp()` with stubbed iTunes client: happy path,
   empty term → 400, ~~bad limit~~ invalid/tampered cursor → 400, upstream
   failure → 502, empty results → `{ results: [] }`, security headers, the
   search-engine opt-out (X-Robots-Tag + robots.txt).
3. **Components** — @testing-library/react with real store + mocked fetch:
   typing → 10 items with kind badges; sentinel intersect → 20 and a prefetch
   at a grown limit; empty → no-results notice; debounce/Enter/retry flows
   under fake timers; clear-on-empty reset; both result-count copy variants.
   IntersectionObserver mocked with a manual-trigger stub.

## Deployment

Built for deployment from day one, not bolted on:

- **Server config**: port comes from `process.env.PORT` (Render injects it);
  `GET /api/health` returns `{ status: 'ok' }` for the platform health check.
- **Render Blueprint**: `render.yaml` at the repo root defines each app as a
  `type: web` Node service (free plan) with `rootDir`, `buildCommand: pnpm install --frozen-lockfile && pnpm build`, `startCommand: pnpm start`, `healthCheckPath: /api/health`.
  The Redux app's service ships first; the Modern.js service is added to the
  same file when that app is built.
- **CI**: GitHub Actions workflow runs typecheck, lint, format check, tests and
  build per app on every push/PR. Deploys happen on Render's auto-deploy from
  the default branch, so CI green + deploy is the full story.
- **Known trade-off**: Render's free tier spins services down when idle — first
  request after a quiet period cold-starts (~30s). Documented in the README so
  it reads as a platform constraint, not a bug. (If always-warm ever matters, an
  external uptime ping or a paid instance fixes it — Luke's call, not in scope.)

## Production readiness (portfolio bar)

This stays up as a portfolio piece, so "done" means production-ready, not demo-ready:

- **Hardening**: `helmet` security headers with a CSP tuned for the app (Apple
  artwork CDN in `img-src`, inline styles allowed for styled-components);
  `compression`; an upstream timeout on every iTunes call (`AbortSignal.timeout`)
  so a hung upstream can't hang us; graceful shutdown on SIGTERM (Render sends it
  on every deploy).
- **Stays current**: Dependabot (npm + GitHub Actions, weekly) with CI as the
  merge gate — the piece keeps progressing with near-zero effort.
- **Search-engine opt-out (2026-09-01)**: the deployed app is deliberately not
  indexable — `X-Robots-Tag: noindex, nofollow` on every response, a deny-all
  `/robots.txt` (served as a route so it exists without the client build), and
  a meta robots tag in `index.html`. It's a portfolio piece shared by link,
  not a public product.
- **Honest scoping**: things deliberately omitted at this scale — rate limiting,
  response caching, structured logging/monitoring beyond the health check — are
  listed in the README with one-line rationale. Documented omissions read as
  judgement; silent ones read as gaps.
- **Sign-off**: the final build task is a production-readiness checklist run
  against the live URL (headers, compression, health, full user journeys),
  not just a local green test run.

## Modern.js app

Same product decisions in framework idiom: the BFF becomes a Modern.js BFF function
(`api/search.ts`, sharing the normalize code where practical), route-loader data flow
replaces Redux for fetch state, infinite reveal stays a client concern. README
contrast: same product, same tests where logic is shared, ~a third of the state
plumbing.

## Build order

1. Redux app to fully done (spec + tests + README).
2. CI (GitHub Actions) + deploy the Redux app to Render.
3. Root README (framing both apps, live URLs, CI badge).
4. Modern.js app, then add its service to `render.yaml` and job to CI.
