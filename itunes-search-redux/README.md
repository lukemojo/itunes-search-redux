# iTunes Search (Redux)

Search iTunes for artists, albums and songs. One request fetches the result set and
the client reveals 10 at a time as you scroll. React + TypeScript + Redux Toolkit on
the client, an Express BFF on the server, one deployable Node service.

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
Browser ──── /api/search?term=… ────► Express BFF ──► 3 × iTunes Search API
   ▲                                     │             (musicArtist / album / song,
   └──────── { results } ◄───────────────┘              in parallel, 8s timeout each)
```

**Why a backend for frontend.** As detailed in the brief, the iTunes API is
CORS-blocked in the browser, so calls go through our own origin. The server also
normalizes the data: loosely-typed iTunes payloads become one discriminated union
(`kind: 'artist' | 'album' | 'song'`), which is where `wrapperType: 'track'` is
narrowed to actual songs rather than movies and TV episodes. The client stays dumb.
In production Express also serves the built client (static + SPA fallback).

**Paging.** iTunes has no working pagination. The commonly cited `offset` parameter
is undocumented and did nothing in manual testing, so there is no second page to ask
for. Rather than fake one by refetching with a growing `limit` — which re-downloads
everything on every step and reshuffles the order — the server takes a single slice
of 50 per entity (`RESULTS_PER_ENTITY` in `src/server/itunes.ts`, iTunes caps `limit`
at 200) and the client reveals 10 rows at a time from what it already has.

One fetch per search, one reveal window, no paging state on the wire. Deeper results
are one constant away if they are ever wanted.

**Search UX.** Search is automatic as you type, debounced by 400ms with a
2-character minimum; Enter searches immediately and is also how single-letter terms
are searched. Responses for a superseded term are dropped so a slow early request
cannot overwrite a later one, and an identical repeat term does not re-hit the API.

**Revealing.** An `IntersectionObserver` sentinel reveals the next 10 as it comes
into view — `rootMargin` gives the zero-height sentinel something to intersect. A
`Load more` button does the same thing for keyboard and screen-reader users, who
never trigger a scroll sentinel.

## Redux notes

Redux Toolkit throughout. `createAsyncThunk` dispatches through the thunk middleware,
satisfying the redux-thunk requirement. One `searchItunes` thunk with its lifecycle
in `extraReducers`, and memoized selectors (`createSelector`) for the reveal window.

State is one fetched list plus a `visibleCount` over it, so "how much is shown" is a
single number rather than a second set of paging flags.

## Testing

Three layers, 39 tests, colocated `*.test.ts(x)`:

- **Pure logic** — payload normalization (including the non-music `wrapperType:
'track'` cases); slice reducers and selectors (reset-on-search, reveal capping,
  stale-response guard).
- **Express route** — supertest against `createApp()` with a stubbed searcher:
  term validation → 400, upstream failure → 502, unknown API path → 404,
  CSP header present.
- **Components** — Testing Library with a real store: reveal via a manual-trigger
  IntersectionObserver stub, debounce behavior with fake timers, error and
  no-results states.

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

- **Rate limiting** — the real exposure on a public proxy is someone hammering
  `/api/search` and burning the upstream quota. A single low-traffic origin behind
  Render did not warrant it here, but `express-rate-limit` on `/api` is the first
  thing to add if this ever took real traffic.
- **Not indexable by Google** — `X-Robots-Tag` on every response plus a deny-all
  `robots.txt`.
- **Response caching** — iTunes responses are already CDN-cached upstream and
  fast; results should feel live.
- **Structured logging / monitoring.**
- **Full styling** — a theme was implemented but a stopping point was reached for
  submission before full styling. The app looks empty when nothing has been searched.
