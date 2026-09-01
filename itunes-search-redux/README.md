# iTunes Search (Redux)

Search iTunes for artists, albums and songs. Results load incrementally and reveal
10 at a time as you scroll. React + TypeScript + Redux Toolkit on the client, an
Express BFF on the server, one deployable Node service.

**Live:** <https://itunes-search-redux.onrender.com>

## Quickstart

Requires Node ≥ 22 and pnpm (pinned via `packageManager` — corepack picks it up).

```bash
pnpm install
pnpm dev          # client on http://localhost:5173, API on :3001 (Vite proxies /api)
pnpm build        # Vite client build + tsc server build → dist/
pnpm start        # production mode: everything served by Express on :3001
pnpm test         # full Vitest suite (server + client projects)
pnpm typecheck    # app + test tsconfigs
pnpm lint         # oxlint
pnpm format       # oxfmt (format:check in CI)
```

## Architecture

```
Browser ── /api/search?term=…[&cursor=…] ──► Express BFF ──► 3 × iTunes Search API
   ▲                                            │              (musicArtist / album / song,
   └── { results, hasMore, next? } ◄────────────┘               in parallel, 8s timeout each)
```

**Why backend for frontend** As detailed in the brief, the API will not work with CORS enabled.
The decision was to use Express and go through our own origin.
The server also normalizes the data into a consistent data set.
Loosely-typed iTunes payloads are normalised into one discriminated union (`kind: 'artist' |
'album' | 'song'`), ensuring the 'track' type is only a song and typing it as such.
The client stays dumb. In production Express also serves the built
client (static + SPA fallback).

**Pagination**: iTunes has no valid way of paginating results. After some research
I found an undocumented `offset` parameter is commonly used but I found it to be
non-functional — verified by manual testing.

Instead the client fetches in growing batches per-entity limit
20 → 40 → 60 … capped at iTunes' max of 200, revealing 10 rows per scroll and
prefetching the next batch before the reveal window runs dry. Two consequences:

- **Server-owned limits via signed cursors.** The limit never appears in the
  public API — each `hasMore` response carries `next`, an HMAC-signed
  token encoding the next limit. Clients send it back as `?cursor=`; protected
  against tampering, which returns a 400. For iTunes this is largely theatre,
  but with strict usage limits I wanted to show guarding against client manipulation.

  Cursors die on restart — the client degrades gracefully
  (keeps what's shown, stops paging, no retry loop).

- **Append-only merge by id.** iTunes' ordering is not consistent across limits, to mitigate this,
  new items are appended only if they have an unseen id, preventing dupes while scrolling.

**Search UX:** Search is automatic as you type, debounced by 400ms with a 2-character minimum;
Enter searches immediately and also facilitates single letter searches. There is a guard on stale
superseded responses, and search terms are diffed so an identical search with results showing
does not hit the API.

**rootMargin** A rootMargin was implemented after the scroll intersection was found to be buggy
due to a zero height sentinel on the bottom of the viewport.

**Load More** A Load More button was later added to mitigate any infinite scroll issues and for accessibility.

Some logic was updated specifically for screen reading and accessibility.

## Redux notes

Redux Toolkit throughout. `createAsyncThunk` dispatches through the thunk middleware.
This should satisfy the redux-thunk requirement. The project contains
`searchItunes` and `loadMore` thunks with lifecycle reducers in `extraReducers`, a `condition`
guard against duplicate in-flight loads, and memoized selectors (`createSelector`) for the
item reveal and pre-fetching.

## Testing

Three layers, 51 tests, colocated `*.test.ts(x)`:

- **Pure logic** — payload normalization; cursor sign/verify round-trips and
  tamper rejection; slice reducers and selectors (reset-on-search, reveal
  capping, append-only merge, stale-response guard, dead-cursor degrade).
- **Express route** — supertest against `createApp()` with a stubbed searcher:
  cursor walk 20 → 40 → 60, invalid cursor/term → 400, upstream failure → 502,
  CSP header present.
- **Components** — Testing Library with a real store: reveal and prefetch flows
  via a manual-trigger IntersectionObserver stub, debounce behavior with fake
  timers, error and no-results states.

Server-side network calls are mocked with MSW at the network boundary — any
unmocked external request errors, while loopback passes through so supertest
can reach the app — never by stubbing fetch, so tests exercise the real fetch
path (URLs, query params, JSON parsing).

```bash
pnpm vitest run --project server   # just the node-env suite
pnpm vitest run --project client   # just the jsdom suite
```

## Production notes

The decision was made to make the app deployable as well as provide the GitHub link.
The following was done to facilitate.

- helmet CSP (Apple's `*.mzstatic.com` artwork CDN allow-listed in `img-src`),
  compression, 8s `AbortSignal.timeout` on every upstream call, graceful SIGTERM
  shutdown.
- Deployed as a Render web service defined in the repo-root `render.yaml`
  (build `pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`,
  health check `/api/health`); auto-deploys from the default branch. CI runs
  typecheck, lint, format check, tests and build on every push; Dependabot keeps
  dependencies and actions current weekly.

## Conscious omissions

- **Rate limiting** — a single low-traffic origin behind Render; the signed
  cursor already blocks limit manipulation.
- **Not indexable by google**
- **Response caching** — iTunes responses are already CDN-cached upstream and
  fast; results should feel live.
- **Structured logging / monitoring**
- **Env-var cursor secret** — per-boot randomness means a deploy invalidates
  in-flight cursors; the client degrades gracefully, so surviving restarts buys
  little here.
- **Full Styling** A theme was implemented but a stopping point was reached for submission
  before full styling. The app looks empty when nothing has been searched.
