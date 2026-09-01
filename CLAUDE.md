# Repo guide

One product, two implementations of an iTunes music search: `itunes-search-redux/` (primary — React + TS + Redux Toolkit + Express BFF) and `itunes-search-modernjs/` (Modern.js port; gitignored until its phase starts). The reviewer-facing decision log is `docs/DECISIONS.md`; the full design doc and build plans were removed from the tree and live in git history (`git log --diff-filter=D -- docs/plans/` finds them) — restore the design doc from history before starting the Modern.js phase.

## Hard rules

- **Commits**: Luke makes every commit. Never run `git add` or `git commit`. End each unit of work at a checkpoint: summarize the change, list files touched, suggest a commit message, and wait for review.
- **Package manager**: pnpm only (pinned via `packageManager` in each app). Never npm, npx, or yarn.
- **Before every checkpoint**: run `pnpm lint`, `pnpm format`, `pnpm typecheck`, and `pnpm test` — hand over green, with the output as evidence.

## Code conventions

- **JSDoc every exported implementation** — functions, hooks, components, types/interfaces, and non-obvious constants. Succinct but clear:
  - One-sentence summary of what it is / why it exists; `/** ... */` on interface members where the name alone doesn't carry it (see `itunes-search-redux/src/shared/types.ts` for the house style).
  - `@param` / `@returns` only when the types don't already say it.
  - Document invariants and gotchas (e.g. "iTunes CORS-blocks browsers, so this must run server-side"), not restatements of the code.
- **iTunes API payloads are looser than they look**: fields vary by `wrapperType`/`kind` (a bare search returns movies, TV episodes, and audiobooks under `wrapperType: "track"`/`"audiobook"`). Type every raw field optional and normalize defensively — discriminate on `kind`, never assume `track` means song.
- Semantic HTML first; presentation lives in styled-components. Don't change element types or ARIA attributes when restyling.
- Tests are colocated (`*.test.ts(x)`), TDD: write the failing test before the implementation.
- **Mock the server's network boundary with MSW** (`msw/node`; unhandled external requests error, loopback passes through for supertest), never by injecting or stubbing fetch — server tests exercise the real fetch path against the foreign iTunes contract (URLs, query params, JSON parsing). The **client** suite instead stubs `fetch` at the BFF seam (a deliberate exception): the debounce tests need synchronous call-count assertions under `vi.useFakeTimers`, which MSW's async interception fights, and the BFF contract is already covered by the server suite.
