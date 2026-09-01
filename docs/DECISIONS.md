# Decision log

The short version of how this app got its shape — the calls that were made on
evidence, and the ones that got reversed. Each was originally worked through in
a full design doc and build plan; those are kept in the git history rather than
the tree, so dig there if you want the complete trail.

## iTunes `offset` is non-functional → growing-limit refetch

The obvious pagination design (fetch more via `offset`) died on contact with
evidence: across every term × entity combination probed, `offset=10` returned
the identical page as `offset=0`. Upstream pagination is impossible. Instead
the client refetches at a growing per-entity limit (20 → 40 → 60, capped at
iTunes' max of 200) and reveals 10 rows per scroll, prefetching before the
reveal window runs dry. Refetching sounds wasteful but isn't: same-query
responses are CDN-cached upstream and byte-stable.

## Paging policy is server-owned, enforced by signed cursors

A first cut exposed `?limit=` and anyone could jump straight to a 3×200 fetch.
The limit now never appears in the public API: each response carries `next`, an
HMAC-signed opaque token encoding the limit the *server* chose; tampering is a
400. The secret is per-boot on purpose — a restart invalidates in-flight
cursors and the client degrades gracefully (keeps what's shown, stops paging)
rather than needing secret management.

## Append-only merge by id

Probing also showed iTunes ordering is not stable across limits — a `limit=40`
response is not the `limit=20` response plus twenty more. So the reducer never
replaces the list: items the user has scrolled past stay fixed, and only
unseen ids append. (A server-side dedupe step was planned, probed, and dropped
— entity-scoped searches don't return duplicate ids, and kind-prefixed ids
can't collide. Dedupe returned client-side, in this merge, with a demonstrated
reason to exist.)

## The infinite-scroll bug jsdom couldn't see

After launch-quality tests were green, real usage stalled after one reveal. A
zero-height sentinel that is the last element on the page sits exactly on the
viewport's bottom boundary at max scroll and never strictly enters it — Chrome
reports it non-intersecting. Found by driving a real browser after the mocked
IntersectionObserver in jsdom made the bug invisible; fixed with
`rootMargin: '200px 0px'`, which is documented in the hook as load-bearing.

## Interleaving: built, then deleted

Results were originally round-robined (artist, album, song, artist…) so every
page showed a mix. The UI redesign read better grouped by kind, and after the
append-only merge the displayed order is client-owned anyway — so the server
round-robin was logic serving a presentational choice that no longer existed.
It was removed rather than kept "because it was already written".

## Overlapping requests are guarded twice

Search-as-you-type makes overlapping requests routine, and reviews found two
distinct races: a slow search settling after the term changed (guarded by
comparing the action's `meta.arg` to the live term — last search wins), and a
slow load-more settling after a new search reset the list, appending the old
term's results (guarded by tracking the in-flight `requestId`). Both guards
are pinned by dedicated interleaving tests.

## Accessibility changed the design, not just the markup

A dedicated WCAG review showed scroll-only infinite reveal is unreachable for
keyboard and screen-reader users, and that conditionally-mounted status
messages are never announced. The fix was structural: a visible "Load more"
button beside the observer sentinel, and a persistent `role="status"` region
that announces the lifecycle and a result count ("Showing 10 of more than 10
results…"), plus explicit `role="list"` (Safari/VoiceOver drops list semantics
from unstyled lists).

## Test seams are chosen per boundary, on purpose

Server tests mock at the network boundary with MSW, so the real fetch path —
URLs, query params, JSON parsing — is exercised against the foreign iTunes
contract. Client tests deliberately stub `fetch` at the BFF seam instead: the
debounce tests need synchronous call-count assertions under fake timers, which
MSW's async interception fights, and the BFF contract is already covered by
the server suite. The distinction is written into the repo conventions.
