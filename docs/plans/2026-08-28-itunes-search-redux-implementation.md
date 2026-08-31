# iTunes Search (Redux app) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the primary iTunes search app — React + TypeScript + Redux Toolkit client, Express BFF server — to fully done (code, tests, READMEs, CI, live Render deploy), per `docs/plans/2026-08-28-itunes-search-design.md`. The bar is production-ready: this stays up as a portfolio piece Luke can point to, and stays easy to progress (see the design doc's "Production readiness" section).

**Architecture:** Single package at `itunes-search-redux/` with `src/client` (Vite + React + Redux Toolkit), `src/server` (Express BFF that fans out to the iTunes Search API, normalizes, interleaves), and `src/shared` (types). The client fetches merged results in growing batches (per-entity limit 20 → 40 → 60, capped at 200 — iTunes' `offset` is non-functional, verified 2026-08-31) and reveals 10 rows at a time via an IntersectionObserver sentinel, prefetching the next batch as the reveal window nears the end of loaded data; the reducer merges refetches append-only by id because upstream ordering shifts between limits. In prod, Express statically serves the Vite build.

**Tech Stack:** TypeScript (strict), React 19, Redux Toolkit (`createAsyncThunk`), Express 5, Vite, Vitest (projects: node env for server, jsdom for client), @testing-library/react, supertest, styled-components, oxlint (linting), oxfmt (formatting), tsx (dev server runner), Node 22, **pnpm** (package manager — pinned via `packageManager`, matching the Modern.js app). Deployment: Render web service (free plan) via `render.yaml` Blueprint; CI via GitHub Actions.

**Repo context:** The repo (`C:\dev\interviews\next`) has **zero commits**. `itunes-search-modernjs/` (existing scaffold) and `docs/` exist already; don't touch the Modern.js app — it has its own plan later. Note the design doc's "Repo layout" section uses older directory names (`next-technical-test-redux`); the real names are `itunes-search-redux` and `itunes-search-modernjs`.

**Commits — CRITICAL:** Claude commits **nothing**. Never run `git add` or `git commit`. Luke reviews every code change and handles all commits himself (he needs to be across the code for interview purposes). Every task therefore ends with a **CHECKPOINT**: stop, summarize what changed and why, list the files touched, and wait for Luke to review/comment/commit before starting the next task. A suggested commit message is included at each checkpoint purely as a convenience — Luke may use, edit, or ignore it.

**Conventions for all tasks:** Run all commands from `C:\dev\interviews\next\itunes-search-redux` unless stated otherwise (Task 1 runs from the repo root). Vitest is imported explicitly (`import { describe, it, expect } from 'vitest'`) — no globals. Server code is ESM with `.js` extensions on relative imports; client code uses bundler resolution (no extensions). Before every checkpoint, run `pnpm lint` and `pnpm format` (from Task 2 onward) so every diff Luke reviews is lint-clean and consistently formatted. **Every exported implementation gets succinct-but-clear JSDoc per the root `CLAUDE.md`** (house style: `src/shared/types.ts`) — apply this even where a plan snippet omits it for brevity.

---

### Task 1: Root gitignore

**Files:**
- Create: `.gitignore` (repo root)

**Step 1: Write root `.gitignore`**

```gitignore
node_modules/
dist/
*.log
.DS_Store
```

**Step 2: CHECKPOINT**

Everything currently in the repo (design doc, this plan, Modern.js scaffold, the new `.gitignore`) is untracked. Hand off to Luke for the initial commit.

Suggested message: `chore: add design doc, plans, Modern.js scaffold, root gitignore`

---

### Task 2: Redux app scaffold (tooling only, no features)

**Files:**
- Create: `itunes-search-redux/package.json`
- Create: `itunes-search-redux/.gitignore`
- Create: `itunes-search-redux/tsconfig.json`
- Create: `itunes-search-redux/tsconfig.server.json`
- Create: `itunes-search-redux/vite.config.ts`
- Create: `itunes-search-redux/.oxlintrc.json`
- Create: `itunes-search-redux/index.html`
- Create: `itunes-search-redux/src/client/main.tsx` (placeholder)
- Create: `itunes-search-redux/src/client/test/setup.ts`

**Step 1: Create `package.json`**

```json
{
  "name": "itunes-search-redux",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "packageManager": "pnpm@9.1.2",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "concurrently -k \"pnpm:dev:server\" \"pnpm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.server.json --noEmit"
  }
}
```

**Step 2: Install dependencies**

```bash
pnpm add express helmet compression react react-dom @reduxjs/toolkit react-redux styled-components
pnpm add -D typescript tsx vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom supertest @types/supertest @types/express @types/compression @types/react @types/react-dom @types/node concurrently oxlint oxfmt
```

(`helmet` and `compression` are part of the production bar — wired up in Task 6.)

**Step 3: Verify the oxfmt / oxlint CLIs**

oxfmt is young and its flags move — confirm before relying on the scripts:

```bash
pnpm oxfmt --help
pnpm oxlint --help
```

Expected: `oxfmt` formats in place when given paths/no args, and has a check mode (`--check` or similar); adjust the `format`/`format:check` scripts to match the actual flags if they differ. oxlint runs with sensible defaults (correctness rules, TS + React plugins).

**Step 4: Create `.oxlintrc.json`**

Minimal config — defaults are good; just make test-runner and browser/node globals explicit and ignore build output:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "ignorePatterns": ["dist"],
  "env": { "browser": true, "node": true, "es2024": true }
}
```

(If the installed oxlint's schema path or option names differ, follow `pnpm oxlint --help` — keep the config minimal.)

**Step 5: Create `.gitignore`**

```gitignore
node_modules/
dist/
```

**Step 6: Create `tsconfig.json` (client + shared, no emit)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  },
  "include": ["src/client", "src/shared", "vite.config.ts"]
}
```

**Step 7: Create `tsconfig.server.json` (server + shared, emits to `dist/`)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/server", "src/shared"],
  "exclude": ["**/*.test.ts"]
}
```

Note: `tsc -p tsconfig.server.json` emits `dist/server/**` and `dist/shared/**`; Vite builds the client into `dist/client` — no collision.

**Step 8: Create `vite.config.ts` with Vitest projects**

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/client' },
  server: { proxy: { '/api': 'http://localhost:3001' } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/client/**/*.test.{ts,tsx}'],
          setupFiles: ['src/client/test/setup.ts'],
        },
      },
    ],
  },
});
```

**Step 9: Create `index.html` (project root — Vite's entry)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>iTunes Search</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

**Step 10: Create placeholder `src/client/main.tsx`**

```tsx
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(<h1>iTunes Search</h1>);
```

**Step 11: Create `src/client/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 12: Verify the toolchain**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Expected: typecheck, lint and format check pass; `vitest run` reports "No test files found" (a non-zero exit for no tests is fine at this stage — confirm the runner itself starts; tests arrive next task).

**Step 13: CHECKPOINT**

Summarize the tooling choices for Luke (scripts, two tsconfigs, Vitest projects, oxlint/oxfmt) and wait for review + commit.

Suggested message: `chore(redux): scaffold Vite + Express + Vitest + oxlint/oxfmt tooling`

---

### Task 3: Shared types + iTunes normalization

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/server/itunes.ts`
- Test: `src/server/itunes.test.ts`

**Step 1: `src/shared/types.ts` — already done.** It was pulled forward into Task 2 and Luke has since JSDoc'd it; that file is the house style for JSDoc. Skip to Step 2.

**Step 2: Write the failing tests for `normalizeItem`**

Create `src/server/itunes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeItem } from './itunes.js';

describe('normalizeItem', () => {
  it('normalizes an artist', () => {
    expect(
      normalizeItem({ wrapperType: 'artist', artistId: 1, artistName: 'Radiohead', primaryGenreName: 'Alternative' }),
    ).toEqual({ kind: 'artist', id: 'artist-1', title: 'Radiohead', subtitle: 'Alternative' });
  });

  it('normalizes an album (collection)', () => {
    expect(
      normalizeItem({
        wrapperType: 'collection',
        collectionId: 2,
        collectionName: 'OK Computer',
        artistName: 'Radiohead',
        artworkUrl100: 'https://img/ok.jpg',
      }),
    ).toEqual({ kind: 'album', id: 'album-2', title: 'OK Computer', subtitle: 'Radiohead', artworkUrl: 'https://img/ok.jpg' });
  });

  it('normalizes a song (track with kind "song")', () => {
    expect(
      normalizeItem({
        wrapperType: 'track',
        kind: 'song',
        trackId: 3,
        trackName: 'Karma Police',
        artistName: 'Radiohead',
        artworkUrl100: 'https://img/kp.jpg',
      }),
    ).toEqual({ kind: 'song', id: 'song-3', title: 'Karma Police', subtitle: 'Radiohead', artworkUrl: 'https://img/kp.jpg' });
  });

  it('rejects non-music tracks: wrapperType "track" alone does not mean song', () => {
    // Real payloads return movies and TV episodes as wrapperType "track"
    expect(
      normalizeItem({ wrapperType: 'track', kind: 'feature-movie', trackId: 9, trackName: 'Thicker Than Water' }),
    ).toBeNull();
    expect(
      normalizeItem({ wrapperType: 'track', kind: 'tv-episode', trackId: 10, trackName: 'Unforgivable Blackness' }),
    ).toBeNull();
  });

  it('returns null for unknown wrapper types or missing essentials', () => {
    expect(normalizeItem({ wrapperType: 'audiobook', collectionId: 5, collectionName: 'A Rare Recording' })).toBeNull();
    expect(normalizeItem({ wrapperType: 'artist' })).toBeNull(); // no id/name
    expect(normalizeItem({})).toBeNull();
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
pnpm vitest run src/server/itunes.test.ts
```

Expected: FAIL — cannot resolve `./itunes.js`.

**Step 4: Implement `normalizeItem` in `src/server/itunes.ts`**

```ts
import type { SearchResult } from '../shared/types.js';

/**
 * The subset of an iTunes Search API result we read. Fields vary by
 * `wrapperType`/`kind` (a bare search mixes music with movies, TV episodes and
 * audiobooks), so everything is optional and normalization must discriminate.
 */
export interface RawItunesItem {
  wrapperType?: string;
  /** Content type within a wrapper, e.g. 'song', 'feature-movie', 'tv-episode'. */
  kind?: string;
  artistId?: number;
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
  trackId?: number;
  trackName?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
}

/**
 * Maps one raw iTunes item to our SearchResult, or null for anything that
 * isn't a music artist, album, or song (movies and TV episodes also arrive as
 * wrapperType 'track', so tracks additionally require kind === 'song').
 */
export function normalizeItem(item: RawItunesItem): SearchResult | null {
  switch (item.wrapperType) {
    case 'artist':
      if (item.artistId === undefined || !item.artistName) return null;
      return {
        kind: 'artist',
        id: `artist-${item.artistId}`,
        title: item.artistName,
        ...(item.primaryGenreName ? { subtitle: item.primaryGenreName } : {}),
      };
    case 'collection':
      if (item.collectionId === undefined || !item.collectionName) return null;
      return {
        kind: 'album',
        id: `album-${item.collectionId}`,
        title: item.collectionName,
        ...(item.artistName ? { subtitle: item.artistName } : {}),
        ...(item.artworkUrl100 ? { artworkUrl: item.artworkUrl100 } : {}),
      };
    case 'track':
      if (item.kind !== 'song' || item.trackId === undefined || !item.trackName) return null;
      return {
        kind: 'song',
        id: `song-${item.trackId}`,
        title: item.trackName,
        ...(item.artistName ? { subtitle: item.artistName } : {}),
        ...(item.artworkUrl100 ? { artworkUrl: item.artworkUrl100 } : {}),
      };
    default:
      return null;
  }
}
```

Design note: `collection` stays discriminated by wrapperType alone — our `entity=album` scoping keeps it music, and audiobooks arrive as `wrapperType: 'audiobook'` (caught by `default`), so there's no music-collection impostor to filter. Tracks get the extra `kind` check because the sample payload proves non-music content shares their wrapper.

**Step 5: Run tests to verify they pass**

```bash
pnpm vitest run src/server/itunes.test.ts
```

Expected: PASS (5 tests).

**Step 6: Lint + format, then CHECKPOINT**

```bash
pnpm lint && pnpm format
```

Suggested message: `feat(server): shared result types and iTunes payload normalization`

---

### Task 4: De-dupe and interleave

**Files:**
- Modify: `src/server/itunes.ts`
- Test: `src/server/itunes.test.ts`

**Step 1: Write the failing tests** (append to `src/server/itunes.test.ts`)

```ts
import { interleave } from './itunes.js';
import type { SearchResult } from '../shared/types.js';

const r = (kind: SearchResult['kind'], n: number): SearchResult => ({
  kind,
  id: `${kind}-${n}`,
  title: `${kind} ${n}`,
});

describe('interleave', () => {
  it('round-robins artist, album, song', () => {
    const result = interleave([r('song', 1), r('song', 2), r('artist', 1), r('album', 1)]);
    expect(result.map((x) => x.id)).toEqual(['artist-1', 'album-1', 'song-1', 'song-2']);
  });

  it('handles a single kind and empty input', () => {
    expect(interleave([r('album', 1), r('album', 2)]).map((x) => x.id)).toEqual(['album-1', 'album-2']);
    expect(interleave([])).toEqual([]);
  });
});
```

(Adjust the existing import line to pull `interleave` alongside `normalizeItem` — one import statement.)

> **Design note (2026-08-31):** a `dedupe` step was originally planned here, but was dropped after verifying empirically that entity-scoped iTunes searches don't return duplicate ids within a call, and kind-prefixed ids (`artist-`/`album-`/`song-`) make cross-call collisions impossible by construction. Bring it back only if duplicates are ever observed. (The 2026-08-31 paging revision later reintroduced de-duping *client-side*, in the reducer's append-only merge — refetches at grown limits do overlap by design.)

**Step 2: Run to verify failure**

```bash
pnpm vitest run src/server/itunes.test.ts
```

Expected: FAIL — `interleave` not exported.

**Step 3: Implement in `src/server/itunes.ts`**

```ts
import type { ResultKind, SearchResult } from '../shared/types.js';

const KIND_ORDER: ResultKind[] = ['artist', 'album', 'song'];

export function interleave(results: SearchResult[]): SearchResult[] {
  const buckets: Record<ResultKind, SearchResult[]> = { artist: [], album: [], song: [] };
  for (const r of results) buckets[r.kind].push(r);
  const out: SearchResult[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const kind of KIND_ORDER) {
      const next = buckets[kind].shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}
```

**Step 4: Run tests, expect PASS**

```bash
pnpm vitest run src/server/itunes.test.ts
```

**Step 5: Lint + format, then CHECKPOINT**

Suggested message: `feat(server): kind-interleave merged results`

---

### Task 5: iTunes fan-out client (`searchItunes`)

**Files:**
- Modify: `src/server/itunes.ts`
- Test: `src/server/itunes.test.ts`

> **Design note (2026-08-31):** originally specced with an injectable `FetchLike` fake; switched to MSW (`msw/node`) so tests intercept at the network boundary and exercise the real fetch path (URL construction, query params, JSON parsing). That made the injection unnecessary, so `searchItunes(term)` just uses global `fetch`.

**Step 1: Install msw** — `pnpm add -D msw`

**Step 2: Write the failing tests** (append)

```ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { searchItunes } from './itunes.js';

const itunesPayload = (results: unknown[]) => ({ resultCount: results.length, results });

const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('searchItunes', () => {
  it('fans out to three entities and returns a merged, interleaved set', async () => {
    const requestedUrls: URL[] = [];
    mswServer.use(
      http.get('https://itunes.apple.com/search', ({ request }) => {
        const url = new URL(request.url);
        requestedUrls.push(url);
        switch (url.searchParams.get('entity')) {
          case 'musicArtist':
            return HttpResponse.json(
              itunesPayload([{ wrapperType: 'artist', artistId: 1, artistName: 'Radiohead' }]),
            );
          case 'album':
            return HttpResponse.json(
              itunesPayload([{ wrapperType: 'collection', collectionId: 2, collectionName: 'OK Computer', artistName: 'Radiohead' }]),
            );
          default:
            return HttpResponse.json(
              itunesPayload([{ wrapperType: 'track', kind: 'song', trackId: 3, trackName: 'Karma Police', artistName: 'Radiohead' }]),
            );
        }
      }),
    );

    const results = await searchItunes('radiohead');

    expect(requestedUrls).toHaveLength(3);
    expect(requestedUrls.map((u) => u.searchParams.get('entity')).sort()).toEqual(['album', 'musicArtist', 'song']);
    expect(requestedUrls.every((u) => u.searchParams.get('term') === 'radiohead')).toBe(true);
    expect(requestedUrls.every((u) => u.searchParams.get('limit') === '50')).toBe(true);
    expect(results.map((x) => x.kind)).toEqual(['artist', 'album', 'song']);
  });

  it('throws when any upstream call is not ok', async () => {
    mswServer.use(
      http.get('https://itunes.apple.com/search', () => new HttpResponse(null, { status: 503 })),
    );
    await expect(searchItunes('x')).rejects.toThrow(/503/);
  });
});
```

**Step 3: Run to verify failure** — `searchItunes` not exported.

**Step 4: Implement** (append to `src/server/itunes.ts`)

```ts
const ITUNES_URL = 'https://itunes.apple.com/search';
const ENTITIES = ['musicArtist', 'album', 'song'] as const;
const UPSTREAM_TIMEOUT_MS = 8000;

export async function searchItunes(term: string): Promise<SearchResult[]> {
  const payloads = await Promise.all(
    ENTITIES.map(async (entity) => {
      const params = new URLSearchParams({ term, entity, limit: '50' });
      const res = await fetch(`${ITUNES_URL}?${params}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`iTunes responded with ${res.status}`);
      const body = (await res.json()) as { results?: RawItunesItem[] };
      return body.results ?? [];
    }),
  );

  const normalized = payloads
    .flat()
    .map(normalizeItem)
    .filter((r): r is SearchResult => r !== null);

  return interleave(normalized);
}
```

`AbortSignal.timeout` (Node 18+) makes a hung upstream reject after 8s instead of hanging our request; the rejection surfaces through the same catch path as a non-ok response (→ 502). The timeout is documented wiring, not separately tested — MSW handlers can't observe the signal, and faking timers around real network interception buys little.

**Step 5: Run all server tests, expect PASS**

```bash
pnpm vitest run --project server
```

**Step 6: Lint + format, then CHECKPOINT**

Suggested message: `feat(server): parallel iTunes fan-out, tested via msw`

---

### Task 6: Paged search API + `createApp` (supertest)

> **Design note (2026-08-31):** revised for the paging revision (see design doc, incl. addendum). `SearchResponse` becomes `{ results, hasMore, next? }`, `searchItunes` takes a per-entity `limit`, and the public API never exposes the limit — clients echo an opaque HMAC-signed `cursor`; the route verifies it (400 on tamper) and computes the limit server-side (start 20, step 20, cap 200).

**Files:**
- Modify: `src/shared/types.ts` (SearchResponse: `total` → `hasMore` + `next?`)
- Modify: `src/server/itunes.ts` (searchItunes takes `limit`, returns SearchResponse)
- Modify: `src/server/itunes.test.ts`
- Create: `src/server/cursor.ts` + `src/server/cursor.test.ts`
- Create: `src/server/routes/search.ts`
- Create: `src/server/app.ts`
- Test: `src/server/app.test.ts`

**Step 1: Update `src/shared/types.ts`** — in `SearchResponse`, replace the `total` member with `hasMore: boolean` (`/** True while refetching with a larger limit may yield more results. */`) and `next?: string` (`/** Opaque signed cursor for the next batch; present only while hasMore. */`). Keep Luke's JSDoc style.

**Step 2: Update the `searchItunes` tests** — the fan-out test asserts `limit` is passed through (`searchItunes('radiohead', 20)` → upstream `limit=20`) and the response shape `{ results, hasMore }`: `hasMore: true` when a mocked entity returns a full page of `limit` items, `false` when all return fewer. Run: FAIL (signature/shape).

**Step 3: Update `src/server/itunes.ts`**

```ts
/** iTunes rejects limits above 200, so paging stops there. */
export const MAX_LIMIT = 200;

export async function searchItunes(term: string, limit: number): Promise<SearchResponse> {
  const payloads = await Promise.all(
    ENTITIES.map(async (entity) => {
      const params = new URLSearchParams({ term, entity, limit: String(limit) });
      // ... fetch + parse as before ...
    }),
  );

  // A full page from any entity means a larger limit may yield more.
  const hasMore = limit < MAX_LIMIT && payloads.some((items) => items.length >= limit);

  const normalized = ...; // as before
  return { results: interleave(normalized), hasMore };
}
```

Run: PASS.

**Step 3b: Cursor module (TDD)** — `src/server/cursor.test.ts` first: round-trips a limit through an opaque token; rejects tampered payloads (valid signature, altered limit); rejects garbage/malformed tokens; rejects out-of-range limits even when correctly signed. Then `src/server/cursor.ts`:

```ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MAX_LIMIT } from './itunes.js';

// Per-boot secret: zero config, and a restart invalidating in-flight cursors
// is harmless — the client keeps what it has shown and simply stops paging.
const SECRET = randomBytes(32);

const sign = (payload: string): string =>
  createHmac('sha256', SECRET).update(payload).digest('base64url');

export function createCursor(limit: number): string {
  const payload = String(limit);
  return `${payload}.${sign(payload)}`;
}

export function readCursor(token: string): number | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  const limit = Number(payload);
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}
```

**Step 4: Write the failing route tests** — `src/server/app.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { SearchResponse, SearchResult } from '../shared/types.js';

const sample: SearchResult[] = [{ kind: 'song', id: 'song-1', title: 'Karma Police', subtitle: 'Radiohead' }];
const respond = (results: SearchResult[], hasMore = false) =>
  vi.fn(async (): Promise<SearchResponse> => ({ results, hasMore }));

describe('GET /api/search', () => {
  it('starts at limit 20 and hands out an opaque next cursor while hasMore', async () => {
    const search = respond(sample, true);
    const res = await request(createApp(search)).get('/api/search').query({ term: 'radiohead' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: sample, hasMore: true, next: expect.any(String) });
    expect(search).toHaveBeenCalledWith('radiohead', 20);
  });

  it('echoing the next cursor advances the limit server-side (20 → 40 → 60)', async () => {
    const search = respond(sample, true);
    const app = createApp(search);

    const first = await request(app).get('/api/search').query({ term: 'radiohead' });
    const second = await request(app)
      .get('/api/search')
      .query({ term: 'radiohead', cursor: first.body.next });
    expect(search).toHaveBeenLastCalledWith('radiohead', 40);

    await request(app).get('/api/search').query({ term: 'radiohead', cursor: second.body.next });
    expect(search).toHaveBeenLastCalledWith('radiohead', 60);
  });

  it('omits the next cursor when there is no more upstream', async () => {
    const res = await request(createApp(respond(sample, false)))
      .get('/api/search')
      .query({ term: 'radiohead' });
    expect(res.body).toEqual({ results: sample, hasMore: false });
  });

  it('ignores any limit param a client tries to pass directly', async () => {
    const search = respond(sample);
    await request(createApp(search)).get('/api/search').query({ term: 'radiohead', limit: '200' });
    expect(search).toHaveBeenCalledWith('radiohead', 20);
  });

  it('returns 400 when term is missing or blank', async () => {
    const app = createApp(respond(sample));
    expect((await request(app).get('/api/search')).status).toBe(400);
    const res = await request(app).get('/api/search').query({ term: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/term/i);
  });

  it('returns 400 for a fabricated or tampered cursor', async () => {
    const app = createApp(respond(sample, true));
    const first = await request(app).get('/api/search').query({ term: 'x' });
    const signature = (first.body.next as string).split('.')[1]!;

    for (const cursor of ['garbage', '200', `200.${signature}`]) {
      const res = await request(app).get('/api/search').query({ term: 'x', cursor });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cursor/i);
    }
  });

  it('returns 502 with a clean body when upstream fails', async () => {
    const search = vi.fn(async (): Promise<SearchResponse> => {
      throw new Error('boom');
    });
    const res = await request(createApp(search)).get('/api/search').query({ term: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'iTunes search is currently unavailable' });
  });

  it('returns an empty result set as results: []', async () => {
    const res = await request(createApp(respond([]))).get('/api/search').query({ term: 'zzz' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], hasMore: false });
  });
});

describe('GET /api/health', () => {
  it('reports ok for the platform health check', async () => {
    const res = await request(createApp(respond([]))).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

Run: FAIL — cannot resolve `./app.js`.

**Step 5: Implement `src/server/routes/search.ts`**

```ts
import { Router } from 'express';
import type { SearchResponse } from '../../shared/types.js';
import { createCursor, readCursor } from '../cursor.js';
import { MAX_LIMIT } from '../itunes.js';

export type Searcher = (term: string, limit: number) => Promise<SearchResponse>;

/** A fresh search always starts here; each next cursor advances by STEP. */
const DEFAULT_LIMIT = 20;
const STEP = 20;

export function createSearchRouter(search: Searcher): Router {
  const router = Router();

  router.get('/search', async (req, res) => {
    const term = typeof req.query.term === 'string' ? req.query.term.trim() : '';
    if (!term) {
      res.status(400).json({ error: 'Query parameter "term" is required' });
      return;
    }

    const rawCursor = req.query.cursor;
    let limit = DEFAULT_LIMIT;
    if (rawCursor !== undefined) {
      const cursorLimit = typeof rawCursor === 'string' ? readCursor(rawCursor) : null;
      if (cursorLimit === null) {
        res.status(400).json({ error: 'Query parameter "cursor" is invalid' });
        return;
      }
      limit = cursorLimit;
    }

    try {
      const { results, hasMore } = await search(term, limit);
      res.json({
        results,
        hasMore,
        ...(hasMore ? { next: createCursor(Math.min(limit + STEP, MAX_LIMIT)) } : {}),
      } satisfies SearchResponse);
    } catch {
      res.status(502).json({ error: 'iTunes search is currently unavailable' });
    }
  });

  return router;
}
```

**Step 6: Implement `src/server/app.ts`**

```ts
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { searchItunes } from './itunes.js';
import { createSearchRouter, type Searcher } from './routes/search.js';

export function createApp(search: Searcher = searchItunes): express.Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Album/track artwork is served from Apple's CDN
          'img-src': ["'self'", 'data:', 'https://*.mzstatic.com'],
          // styled-components injects inline <style> at runtime
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(compression());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', createSearchRouter(search));

  const clientDist = path.resolve(import.meta.dirname, '../client');
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
```

Note: from `dist/server/app.js`, `../client` is `dist/client` (the Vite build). Express 5 removed `app.get('*')`-style wildcards; the plain `app.use` fallback avoids path-to-regexp entirely. Don't add CORS middleware — same-origin by design. Helmet's CSP defaults cover the rest (`script-src 'self'` suits the Vite build); if a directive name changed in the installed helmet major, follow its README rather than fighting the snippet.

**Step 7: Run, expect PASS**

```bash
pnpm vitest run --project server
```

Optionally add one header smoke assertion to an existing test: `expect(res.headers['content-security-policy']).toContain("img-src 'self' data: https://*.mzstatic.com")`.

Note: the 404-fallback `sendFile` is not exercised by these tests (no `dist/client` yet) — prod smoke covers it in Task 12.

**Step 8: Lint + format, then CHECKPOINT**

Suggested message: `feat(server): cursor-paged /api/search and /api/health with 400/502 handling and static serving`

---

### Task 7: Server bootstrap + dev smoke test

**Files:**
- Create: `src/server/index.ts`

**Step 1: Create `src/server/index.ts`**

```ts
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

const server = createApp().listen(port, () => {
  console.log(`iTunes search server listening on http://localhost:${port}`);
});

// Render sends SIGTERM on every deploy/restart: stop accepting connections,
// let in-flight requests finish, then exit.
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
```

(`PORT` from the environment is what Render injects in production — don't hardcode.)

**Step 2: Smoke-test against the real iTunes API**

Start the server in the background, then:

```bash
curl -s "http://localhost:3001/api/search?term=radiohead" | head -c 400
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/search"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/search?term=x&cursor=forged"
```

Expected: first response is JSON with `results` mixing kinds, a `hasMore` boolean, and a signed `next` cursor (follow it with `curl "...&cursor=<next>"` to see the batch grow); the last two commands print `400`. Stop the server after.

**Step 3: Lint + format, then CHECKPOINT**

Report the smoke-test output to Luke (paste the response snippet).

Suggested message: `feat(server): bootstrap entry point`

---

### Task 8: Redux slice — reducers + thunks

> **Design note (2026-08-31):** revised for the paging revision — two thunks (`searchItunes` fresh, `loadMore` echoing the server's signed `next` cursor, with append-only merge by id), `next`/`hasMore`/`loadingMore` in state. The client never sees a limit; a failed loadMore keeps shown results and stops paging (no retry loop).

**Files:**
- Create: `src/client/store/searchSlice.ts`
- Test: `src/client/store/searchSlice.test.ts`

**Step 1: Write the failing tests** — `src/client/store/searchSlice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../../shared/types';
import reducer, {
  PAGE_SIZE,
  loadMore,
  revealMore,
  searchItunes,
  type SearchState,
} from './searchSlice';

const results = (n: number, offset = 0): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'song', id: `song-${i + offset}`, title: `Song ${i + offset}` }));

const succeeded = (n: number, hasMore = false): SearchState => ({
  term: 'beatles',
  status: 'succeeded',
  results: results(n),
  visibleCount: PAGE_SIZE,
  hasMore,
  ...(hasMore ? { next: 'signed-cursor' } : {}),
});

describe('searchSlice', () => {
  it('search pending resets results, error, cursor and visibleCount, and stores the term', () => {
    const prior: SearchState = { ...succeeded(30, true), visibleCount: 30, error: 'old' };
    const state = reducer(prior, searchItunes.pending('req1', 'oasis'));
    expect(state).toEqual({
      term: 'oasis',
      status: 'loading',
      results: [],
      visibleCount: PAGE_SIZE,
      hasMore: false,
      next: undefined,
      error: undefined,
    });
  });

  it('search fulfilled stores results, hasMore and the next cursor', () => {
    const pending = reducer(undefined, searchItunes.pending('req1', 'beatles'));
    const state = reducer(
      pending,
      searchItunes.fulfilled({ results: results(25), hasMore: true, next: 'abc.sig' }, 'req1', 'beatles'),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(25);
    expect(state.hasMore).toBe(true);
    expect(state.next).toBe('abc.sig');
    expect(state.visibleCount).toBe(PAGE_SIZE);
  });

  it('search rejected stores the error message', () => {
    const pending = reducer(undefined, searchItunes.pending('req1', 'beatles'));
    const state = reducer(pending, searchItunes.rejected(new Error('iTunes search is currently unavailable'), 'req1', 'beatles'));
    expect(state.status).toBe('failed');
    expect(state.error).toBe('iTunes search is currently unavailable');
  });

  it('revealMore adds a page, capped at results.length', () => {
    expect(reducer(succeeded(25), revealMore()).visibleCount).toBe(20);
    expect(reducer({ ...succeeded(25), visibleCount: 20 }, revealMore()).visibleCount).toBe(25);
    expect(reducer(succeeded(4), revealMore()).visibleCount).toBe(4);
  });

  it('loadMore merges append-only by id: existing items stay fixed, only unseen ids append', () => {
    const prior = succeeded(20, true);
    // Refetched page reshuffles and overlaps: 5 old ids in new positions + 10 new ones
    const refetched = [...results(5, 15).reverse(), ...results(10, 20)];
    const pending = reducer(prior, loadMore.pending('req2'));
    expect(pending.status).toBe('loadingMore');
    const state = reducer(pending, loadMore.fulfilled({ results: refetched, hasMore: false }, 'req2'));
    expect(state.status).toBe('succeeded');
    expect(state.results.slice(0, 20)).toEqual(prior.results); // untouched
    expect(state.results).toHaveLength(30); // 20 kept + 10 genuinely new
    expect(state.hasMore).toBe(false);
    expect(state.next).toBeUndefined(); // upstream exhausted — no further cursor
    expect(state.visibleCount).toBe(PAGE_SIZE); // loading more never reveals
  });

  it('loadMore rejected keeps the shown results, stays succeeded, and stops paging', () => {
    const pending = reducer(succeeded(20, true), loadMore.pending('req2'));
    const state = reducer(pending, loadMore.rejected(new Error('boom'), 'req2'));
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(20);
    expect(state.error).toBe('boom');
    // A dead cursor (e.g. server restarted) must not retry-loop
    expect(state.hasMore).toBe(false);
    expect(state.next).toBeUndefined();
  });
});
```

**Step 2: Run to verify failure**

```bash
pnpm vitest run src/client/store/searchSlice.test.ts
```

**Step 3: Implement `src/client/store/searchSlice.ts`**

```ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { SearchResponse, SearchResult } from '../../shared/types';

/** How many merged results each scroll reveals. */
export const PAGE_SIZE = 10;

export interface SearchState {
  term: string;
  status: 'idle' | 'loading' | 'loadingMore' | 'succeeded' | 'failed';
  /** Loaded so far — append-only merged by id (upstream ordering shifts between fetches). */
  results: SearchResult[];
  visibleCount: number;
  /** Opaque server cursor for the next batch; absent when upstream is exhausted. */
  next?: string;
  /** Server says a refetch may yield more. */
  hasMore: boolean;
  error?: string;
}

const initialState: SearchState = {
  term: '',
  status: 'idle',
  results: [],
  visibleCount: PAGE_SIZE,
  hasMore: false,
};

async function fetchSearch(term: string, cursor?: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ term, ...(cursor ? { cursor } : {}) });
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }
  return (await res.json()) as SearchResponse;
}

/** Fresh search: fetches the first batch and resets all paging state. */
export const searchItunes = createAsyncThunk<SearchResponse, string>(
  'search/searchItunes',
  (term) => fetchSearch(term),
);

/**
 * Extends the loaded set by echoing the server's signed cursor. Guarded so
 * only one load runs at a time and only while a cursor exists.
 */
export const loadMore = createAsyncThunk<SearchResponse, void, { state: { search: SearchState } }>(
  'search/loadMore',
  (_, { getState }) => {
    const { term, next } = getState().search;
    return fetchSearch(term, next);
  },
  {
    condition: (_, { getState }) => {
      const { status, next } = getState().search;
      return status === 'succeeded' && next !== undefined;
    },
  },
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    revealMore(state) {
      state.visibleCount = Math.min(state.visibleCount + PAGE_SIZE, state.results.length);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchItunes.pending, (state, action) => {
        state.status = 'loading';
        state.term = action.meta.arg;
        state.results = [];
        state.visibleCount = PAGE_SIZE;
        state.next = undefined;
        state.hasMore = false;
        state.error = undefined;
      })
      .addCase(searchItunes.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.results = action.payload.results;
        state.hasMore = action.payload.hasMore;
        state.next = action.payload.next;
      })
      .addCase(searchItunes.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Search failed';
      })
      .addCase(loadMore.pending, (state) => {
        state.status = 'loadingMore';
      })
      .addCase(loadMore.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.hasMore = action.payload.hasMore;
        state.next = action.payload.next;
        // Append-only merge: never reorder or replace what the user has seen.
        const seen = new Set(state.results.map((result) => result.id));
        for (const result of action.payload.results) {
          if (!seen.has(result.id)) state.results.push(result);
        }
      })
      .addCase(loadMore.rejected, (state, action) => {
        // Keep what's shown; surface the error without blowing the list away.
        // Drop the cursor so a dead one (e.g. server restart) can't retry-loop.
        state.status = 'succeeded';
        state.hasMore = false;
        state.next = undefined;
        state.error = action.error.message ?? 'Loading more failed';
      });
  },
});

export const { revealMore } = searchSlice.actions;
export default searchSlice.reducer;
```

**Step 4: Run, expect PASS.**

**Step 5: Lint + format, then CHECKPOINT**

Suggested message: `feat(client): search slice with paged thunks and append-only merge`

---

### Task 9: Selectors

**Files:**
- Modify: `src/client/store/searchSlice.ts`
- Test: `src/client/store/searchSlice.test.ts`

**Step 1: Write the failing tests** (append; reuse `results`/`succeeded` helpers)

```ts
import { selectHasMore, selectShouldLoadMore, selectVisibleResults } from './searchSlice';

describe('selectors', () => {
  const wrap = (search: SearchState) => ({ search });

  it('selectVisibleResults returns the first visibleCount results', () => {
    const visible = selectVisibleResults(wrap(succeeded(25)));
    expect(visible).toHaveLength(PAGE_SIZE);
    expect(visible[0]?.id).toBe('song-0');
  });

  it('selectHasMore is true while unrevealed items remain locally or upstream', () => {
    expect(selectHasMore(wrap(succeeded(25)))).toBe(true); // unrevealed loaded items
    expect(selectHasMore(wrap({ ...succeeded(25), visibleCount: 25 }))).toBe(false); // fully revealed, upstream done
    expect(selectHasMore(wrap({ ...succeeded(25, true), visibleCount: 25 }))).toBe(true); // upstream has more
    expect(selectHasMore(wrap(succeeded(4)))).toBe(false);
  });

  it('selectShouldLoadMore prefetches when the reveal window nears the end of loaded data', () => {
    expect(selectShouldLoadMore(wrap({ ...succeeded(25, true), visibleCount: 20 }))).toBe(true); // 5 unrevealed left
    expect(selectShouldLoadMore(wrap({ ...succeeded(25, true), visibleCount: 10 }))).toBe(false); // 15 left — no need yet
    expect(selectShouldLoadMore(wrap({ ...succeeded(25, false), visibleCount: 20 }))).toBe(false); // upstream exhausted
    expect(selectShouldLoadMore(wrap({ ...succeeded(25, true), visibleCount: 20, status: 'loadingMore' }))).toBe(false); // already loading
  });
});
```

**Step 2: Run to verify failure.**

**Step 3: Implement** (append to `searchSlice.ts`)

```ts
interface WithSearch {
  search: SearchState;
}

export const selectStatus = (state: WithSearch) => state.search.status;
export const selectTerm = (state: WithSearch) => state.search.term;
export const selectError = (state: WithSearch) => state.search.error;
export const selectVisibleResults = (state: WithSearch) =>
  state.search.results.slice(0, state.search.visibleCount);

/** True while scrolling can show more — unrevealed loaded items, or more upstream. */
export const selectHasMore = (state: WithSearch) =>
  state.search.visibleCount < state.search.results.length || state.search.hasMore;

/**
 * True when the next reveal would leave under a page of loaded headroom, the
 * server reports more, and no load is in flight — the prefetch trigger.
 */
export const selectShouldLoadMore = (state: WithSearch) =>
  state.search.status === 'succeeded' &&
  state.search.hasMore &&
  state.search.results.length - state.search.visibleCount <= PAGE_SIZE;
```

**Step 4: Run, expect PASS.**

**Step 5: Lint + format, then CHECKPOINT**

Suggested message: `feat(client): visibility selectors`

---

### Task 10: Store + typed hooks + infinite-reveal hook

**Files:**
- Create: `src/client/store/index.ts`
- Create: `src/client/hooks/useInfiniteReveal.ts`
- Create: `src/client/test/mockIntersectionObserver.ts`

No new tests here — `makeStore` and the hook are exercised by the component tests in Task 11 (the hook's behavior is only meaningful in the DOM).

**Step 1: Create `src/client/store/index.ts`**

```ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import searchReducer from './searchSlice';

export const makeStore = () =>
  configureStore({
    reducer: { search: searchReducer },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

**Step 2: Create `src/client/hooks/useInfiniteReveal.ts`**

```ts
import { useEffect, useRef } from 'react';

export function useInfiniteReveal(onReveal: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!enabled || !el) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onReveal();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, onReveal]);

  return sentinelRef;
}
```

**Step 3: Create `src/client/test/mockIntersectionObserver.ts`**

```ts
import { vi } from 'vitest';

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  constructor(private callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  static reset() {
    MockIntersectionObserver.instances = [];
  }

  static install() {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  }
}
```

**Step 4: Typecheck + lint + format, then CHECKPOINT**

```bash
pnpm typecheck && pnpm lint && pnpm format
```

Suggested message: `feat(client): store factory, typed hooks, infinite-reveal hook`

---

### Task 11: Components (semantic markup) + component tests

**Files:**
- Create: `src/client/components/ResultCard.tsx`
- Create: `src/client/components/SearchResults.tsx`
- Create: `src/client/components/SearchForm.tsx`
- Create: `src/client/App.tsx`
- Test: `src/client/App.test.tsx`

**Step 1: Write the failing tests** — `src/client/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { makeStore } from './store';
import { MockIntersectionObserver } from './test/mockIntersectionObserver';
import type { SearchResult } from '../shared/types';

const makeResults = (n: number): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: (['artist', 'album', 'song'] as const)[i % 3]!,
    id: `id-${i}`,
    title: `Result ${i}`,
    subtitle: `Sub ${i}`,
  }));

/** Stubs fetch to answer each /api/search call by the cursor it carries (null = fresh search). */
const stubFetch = (
  respond: (cursor: string | null) => { results: SearchResult[]; hasMore: boolean; next?: string },
) => {
  const fetchMock = vi.fn(async (url: string) => {
    const cursor = new URL(url, 'http://localhost').searchParams.get('cursor');
    return { ok: true, status: 200, json: async () => respond(cursor) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** One fixed page regardless of limit, with no more upstream. */
const singleBatch = (results: SearchResult[]) => () => ({ results, hasMore: false });

const renderApp = () => render(
  <Provider store={makeStore()}>
    <App />
  </Provider>,
);

const search = async (term: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('searchbox'), term);
  await user.click(screen.getByRole('button', { name: /search/i }));
  return user;
};

beforeEach(() => {
  MockIntersectionObserver.install();
});

afterEach(() => {
  MockIntersectionObserver.reset();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the first 10 results with kind badges after a search', async () => {
    stubFetch(singleBatch(makeResults(25)));
    renderApp();
    await search('radiohead');

    const list = await screen.findByRole('list', { name: /search results/i });
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Album').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Song').length).toBeGreaterThan(0);
    expect(list).toBeInTheDocument();
  });

  it('reveals 10 more when the sentinel intersects', async () => {
    stubFetch(singleBatch(makeResults(25)));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    const observer = MockIntersectionObserver.instances.at(-1)!;
    const { act } = await import('react');
    act(() => observer.trigger());

    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });

  it('prefetches the next batch when the reveal window nears the end of loaded data', async () => {
    // First batch loads 15 with more upstream: 5 unrevealed after the initial 10,
    // so the prefetch trigger fires immediately, echoing the server's cursor.
    const fetchMock = stubFetch((cursor) =>
      cursor === null
        ? { results: makeResults(15), hasMore: true, next: 'cursor-40' }
        : { results: makeResults(35), hasMore: false },
    );
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('cursor=cursor-40');

    // The appended batch is revealable on the next intersect
    const observer = MockIntersectionObserver.instances.at(-1)!;
    const { act } = await import('react');
    act(() => observer.trigger());
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });

  it('notifies the user when there are no results', async () => {
    stubFetch(singleBatch([]));
    renderApp();
    await search('zzzzzz');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/no results found for/i);
    expect(status).toHaveTextContent('zzzzzz');
  });

  it('shows the server error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: 'iTunes search is currently unavailable' }),
      })),
    );
    renderApp();
    await search('radiohead');

    expect(await screen.findByRole('alert')).toHaveTextContent('iTunes search is currently unavailable');
  });
});
```

**Step 2: Run to verify failure**

```bash
pnpm vitest run src/client/App.test.tsx
```

Expected: FAIL — cannot resolve `./App`.

**Step 3: Implement `src/client/components/ResultCard.tsx`**

```tsx
import type { ResultKind, SearchResult } from '../../shared/types';

const KIND_LABELS: Record<ResultKind, string> = {
  artist: 'Artist',
  album: 'Album',
  song: 'Song',
};

export function ResultCard({ result }: { result: SearchResult }) {
  return (
    <li>
      <article>
        {result.artworkUrl && <img src={result.artworkUrl} alt="" width={60} height={60} loading="lazy" />}
        <div>
          <span aria-label={`Type: ${KIND_LABELS[result.kind]}`}>{KIND_LABELS[result.kind]}</span>
          <h2>{result.title}</h2>
          {result.subtitle && <p>{result.subtitle}</p>}
        </div>
      </article>
    </li>
  );
}
```

**Step 4: Implement `src/client/components/SearchResults.tsx`**

```tsx
import { useCallback, useEffect } from 'react';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loadMore,
  revealMore,
  selectError,
  selectHasMore,
  selectShouldLoadMore,
  selectStatus,
  selectTerm,
  selectVisibleResults,
} from '../store/searchSlice';
import { ResultCard } from './ResultCard';

export function SearchResults() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const term = useAppSelector(selectTerm);
  const error = useAppSelector(selectError);
  const visible = useAppSelector(selectVisibleResults);
  const hasMore = useAppSelector(selectHasMore);
  const shouldLoadMore = useAppSelector(selectShouldLoadMore);

  // Prefetch is state-driven, not scroll-driven: whenever the reveal window
  // nears the end of loaded data, extend it (the thunk's condition guard
  // makes duplicate dispatches no-ops).
  useEffect(() => {
    if (shouldLoadMore) dispatch(loadMore());
  }, [shouldLoadMore, dispatch]);

  const reveal = useCallback(() => dispatch(revealMore()), [dispatch]);
  const sentinelRef = useInfiniteReveal(reveal, hasMore);

  if (status === 'idle') return null;
  if (status === 'loading') return <p role="status">Searching…</p>;
  if (status === 'failed') return <p role="alert">{error}</p>;
  if (visible.length === 0) return <p role="status">No results found for “{term}”</p>;

  return (
    <>
      <ul aria-label="Search results">
        {visible.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </ul>
      {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
```

**Step 5: Implement `src/client/components/SearchForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useAppDispatch } from '../store';
import { searchItunes } from '../store/searchSlice';

export function SearchForm() {
  const dispatch = useAppDispatch();
  const [term, setTerm] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed) dispatch(searchItunes(trimmed));
  };

  return (
    <form role="search" onSubmit={onSubmit}>
      <label htmlFor="search-term">Search artists, albums and songs</label>
      <input
        id="search-term"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="e.g. Radiohead"
      />
      <button type="submit">Search</button>
    </form>
  );
}
```

**Step 6: Implement `src/client/App.tsx`**

```tsx
import { SearchForm } from './components/SearchForm';
import { SearchResults } from './components/SearchResults';

export default function App() {
  return (
    <>
      <header>
        <h1>iTunes Search</h1>
        <SearchForm />
      </header>
      <main>
        <SearchResults />
      </main>
    </>
  );
}
```

**Step 7: Run, expect PASS**

```bash
pnpm vitest run --project client
```

**Step 8: Wire up `src/client/main.tsx` for real**

```tsx
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { makeStore } from './store';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <Provider store={makeStore()}>
    <App />
  </Provider>,
);
```

**Step 9: Full suite + typecheck + lint + format, then CHECKPOINT**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format
```

Suggested message: `feat(client): search UI with infinite reveal and a11y states`

---

### Task 12: Dev + prod smoke test

**Step 1: Dev smoke** — run `pnpm dev`, open http://localhost:5173, search "radiohead". Expect: 10 mixed-kind rows, scrolling reveals more, and the network tab shows growing batches (a bare fetch, then `cursor=…` fetches as scrolling continues); a gibberish term shows the no-results notice. (If running non-interactively, verify via `curl http://localhost:5173/api/search?term=radiohead` to prove the proxy, and rely on component tests for UI.)

**Step 2: Prod smoke**

```bash
pnpm build
pnpm start
```

Then `curl -s http://localhost:3001/ | head -c 200` → the built `index.html`; `curl -s "http://localhost:3001/api/search?term=radiohead" | head -c 200` → JSON. Stop the server.

**Step 3: CHECKPOINT** — report both smoke results to Luke. If fixes were needed, they're part of this checkpoint's diff; otherwise there is nothing to commit.

---

### Task 13: Styling with styled-components

**Files:**
- Create: `src/client/styles/GlobalStyle.ts`
- Modify: `src/client/App.tsx`, `src/client/components/*.tsx`

**Step 1: Create `src/client/styles/GlobalStyle.ts`**

```ts
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    line-height: 1.5;
  }
`;
```

**Step 2: Restyle components.** Convert presentation to styled-components while **keeping the element types and ARIA attributes identical** (tests must keep passing). Guidelines, not verbatim requirements:

- `App.tsx`: render `<GlobalStyle />` first; centered column layout, max-width ~40rem.
- `SearchForm`: visually-hidden label (styled, still in the DOM), rounded search input + button on one row.
- `SearchResults`: `ul` with `list-style: none; padding: 0; display: grid; gap: 0.5rem;`.
- `ResultCard`: card row — artwork left (60px, rounded), badge as a small pill whose colour varies by `kind` (prop-based), title/subtitle stacked. Use `article { display: flex; gap: 1rem; }`.
- Status/error paragraphs: centered, muted; error in a red tone.

Example badge pattern:

```tsx
const Badge = styled.span<{ $kind: ResultKind }>`
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: #fff;
  background: ${({ $kind }) =>
    $kind === 'artist' ? '#6e56cf' : $kind === 'album' ? '#0e7490' : '#be185d'};
`;
```

**Step 3: Verify** — `pnpm test` (all component tests still green), then `pnpm dev` and eyeball it.

**Step 4: Lint + format, then CHECKPOINT**

Suggested message: `feat(client): styled-components presentation layer`

---

### Task 14: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml` (repo root)

**Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  redux-app:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: itunes-search-redux
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4 # reads the version from package.json's packageManager field
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: itunes-search-redux/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm test
      - run: pnpm build
```

(A `modernjs-app` job gets added when that app is built.)

**Step 2: Create `.github/dependabot.yml`** — keeps the piece current with near-zero effort; CI is the merge gate for its PRs:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /itunes-search-redux
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

**Step 3: Verify locally what CI will run**

```bash
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

Expected: all green — this is exactly the CI sequence.

**Step 4: CHECKPOINT**

Luke: this is the point to create the GitHub repo and push (CI and Dependabot can't run until the repo is on GitHub). The workflow triggers on `master` and `main`, so either default branch works.

Suggested message: `ci: GitHub Actions workflow and Dependabot for the Redux app`

---

### Task 15: Render Blueprint + deploy

**Files:**
- Create: `render.yaml` (repo root)

**Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: itunes-search-redux
    runtime: node
    plan: free
    rootDir: itunes-search-redux
    buildCommand: pnpm install --frozen-lockfile && pnpm build
    startCommand: pnpm start
    healthCheckPath: /api/health
```

(The Modern.js app is added as a second service in this file when it's built. If Render rejects a field name, check their Blueprint spec — field names occasionally shift. Render picks up pnpm from the `packageManager` field in `package.json` via corepack; if the build logs show npm being used instead, the fix is documented in Render's Node docs.)

**Step 2: CHECKPOINT — deploy is Luke's action**

Claude cannot do this part (Render account + GitHub authorization):

1. Commit + push `render.yaml`.
2. In the Render dashboard: **New → Blueprint**, select the GitHub repo, apply. Render creates the `itunes-search-redux` web service on the free plan with auto-deploy from the default branch.
3. Wait for the first deploy, then verify: `https://<service>.onrender.com/api/health` → `{"status":"ok"}`, and a search in the browser works end-to-end.
4. Note the live URL — the README tasks reference it.

Expect free-tier cold starts (~30s after idle) — that's normal and gets documented in the README.

Suggested message: `chore: Render blueprint for the Redux app`

---

### Task 16: App README

**Files:**
- Create: `itunes-search-redux/README.md`

**Step 1: Write the README.** Cover, briefly and concretely:

- What it is: iTunes music search — artists, albums, songs; 10 at a time with infinite reveal. **Live URL** (from Task 15) up top, with a note that the free tier cold-starts after idle (~30s first load).
- Quickstart: `pnpm install`, `pnpm dev` (client http://localhost:5173, API :3001), `pnpm build && pnpm start` (everything on :3001), `pnpm test`, `pnpm lint`, `pnpm format`.
- Deployment: Render web service defined in the root `render.yaml` (build `pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`, health check `/api/health`); auto-deploys from the default branch.
- Production notes: helmet CSP (Apple artwork CDN allowed), compression, 8s upstream timeout on iTunes calls, graceful SIGTERM shutdown, Dependabot + CI keeping dependencies current.
- **Conscious omissions** (one line of rationale each): rate limiting (single low-traffic origin behind Render; add express-rate-limit if it ever matters), response caching (iTunes is fast enough and results should feel live; a TTL cache is the obvious next step), structured logging/monitoring beyond the health check (nothing to page anyone about). Documented omissions read as judgement.
- Architecture: why the Express BFF exists (iTunes API is CORS-blocked in browsers; also merges/normalizes/interleaves so the client stays dumb), and the paging story: iTunes `offset` is non-functional (verified empirically — identical pages at every offset), so the client fetches in growing batches (limit 20 → 40 → 60, server-owned via opaque signed cursors — clients can't jump the queue) with 10-at-a-time reveal and append-only merge by id (upstream ordering shifts between limits).
- Redux notes: Redux Toolkit; `createAsyncThunk` **is** redux-thunk under the hood (dispatches through the thunk middleware) — this satisfies the redux-thunk requirement with current best practice.
- Testing: the three layers (pure logic, supertest route, component tests) and how to run them.

**Step 2: CHECKPOINT**

Suggested message: `docs(redux): app README`

---

### Task 17: Root README (framing both apps)

**Files:**
- Create: `README.md` (repo root)

**Step 1: Write it.** Short. Sections:

- **CI badge** (GitHub Actions status) at the top, plus the live Render URL.
- **One product, two implementations** — `itunes-search-redux/` is the primary submission (React + TS + Redux Toolkit + thunk + Express static serving); `itunes-search-modernjs/` re-implements the same product in Modern.js to show how the architecture maps to a full-stack framework (BFF function replaces the Express server, loaders replace fetch-state plumbing). Note the Modern.js app's status honestly (scaffold / in progress) until it ships — it is currently gitignored, so don't link into it yet.
- **Requirements recap** — the product requirements from the design doc, including the self-imposed "built for deployment" one.
- **Where to look** — pointer to each app's README, `render.yaml`, `.github/workflows/ci.yml`, and `docs/plans/` for design history.

**Step 2: CHECKPOINT**

Suggested message: `docs: root README framing both implementations`

---

### Task 18: Final verification + production-readiness sign-off

This is the "can I point people at this and leave it up?" gate. Run every check and report the evidence to Luke — no claim without output.

**Step 1: Local gate** — from `itunes-search-redux/`: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build` — all green.

**Step 2: CI + deploy gate** — CI green on GitHub for the latest commit; Render shows the latest deploy live.

**Step 3: Live-URL checklist** (replace `<URL>` with the Render URL):

- `curl -s <URL>/api/health` → `{"status":"ok"}`
- `curl -sI <URL>/` → `content-security-policy` header present (with the mzstatic `img-src`) and other helmet headers (`x-content-type-options`, etc.)
- `curl -sI -H "Accept-Encoding: gzip" <URL>/` → compressed response (`content-encoding`)
- `curl -s -o /dev/null -w "%{http_code}" "<URL>/api/search"` → `400`
- In a browser: real search shows 10 mixed-kind rows with artwork; scrolling reveals more; gibberish term shows the no-results notice; works at a mobile viewport width.
- Deep link (e.g. `<URL>/anything`) serves the app, not a 404 (index fallback).

**Step 4: Longevity check** — Dependabot config present on GitHub (Insights → Dependency graph → Dependabot); READMEs accurate including live URL, cold-start note, and conscious omissions.

**Step 5:** Report all evidence to Luke; he confirms `git status` is clean after his final commit.

**Step 6:** Use superpowers:requesting-code-review to review the finished app against the design doc before starting the Modern.js plan.

---

## Out of scope for this plan

The Modern.js implementation (build-order step 4) gets its own plan after this one ships and is reviewed — that plan also adds its Render service to `render.yaml` and its job to CI, and removes `itunes-search-modernjs/` from the root `.gitignore` (Luke gitignored it until we come to it) — its BFF/loader shape should mirror what actually got built here. When writing that plan, read `itunes-search-modernjs/AGENTS.md` first: the Modern.js docs ship inside `node_modules/@modern-js/app-tools/docs/` and are the source of truth.
