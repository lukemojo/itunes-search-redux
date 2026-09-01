# iTunes Search — one product, two implementations

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

**Live:** <https://itunes-search-redux.onrender.com>

An iTunes music search — type a term, get matching artists, albums and songs,
revealed 10 at a time as you scroll — implemented twice to show the same
architecture expressed two ways:

- **[`itunes-search-redux/`](itunes-search-redux/)** — the primary submission.
  React + TypeScript + Redux Toolkit (thunks) on the client, an Express BFF
  serving both the API and the static build. Hand-rolled where it teaches
  something: signed paging cursors, append-only merge, MSW-tested fan-out.
- **`itunes-search-modernjs/`** — the same product re-implemented in Modern.js,
  showing how the architecture maps onto a full-stack framework: a BFF function
  replaces the Express server, route loaders replace the fetch-state plumbing.
  *Status: in progress — scaffolded but not yet part of the repo (gitignored
  until its build phase starts).*

## Requirements

- Search for an artist, album or song; see matching Artists, Albums and/or Songs.
- Show 10 items at a time; scrolling down reveals another 10.
- Empty result set → the user is told there are no results.
- The iTunes Search API is CORS-blocked in browsers → calls go through
  Node/Express.
- Semantic, well-structured markup; unit testing throughout.
- Self-imposed: **built for deployment** — live on a public URL with CI green on
  the repo. A running product demonstrates more than a zip of source.
- Self-imposed: **production-ready as a lasting portfolio piece** — hardened
  server, dependencies kept current automatically (Dependabot), safe to leave up.

## Where to look

| | |
|---|---|
| App walkthrough, architecture & paging story | [`itunes-search-redux/README.md`](itunes-search-redux/README.md) |
| CI pipeline | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Deployment blueprint | [`render.yaml`](render.yaml) |
| Decision log — the evidence-driven calls and the ones that got reversed | [`docs/DECISIONS.md`](docs/DECISIONS.md) |

The full working design doc and step-by-step build plan behind the decision log
live in the git history (removed from the tree to keep the repo lean) — dig
there if you want the complete trail.
