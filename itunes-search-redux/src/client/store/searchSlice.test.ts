import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../../shared/types';
import reducer, {
  PAGE_SIZE,
  loadMore,
  revealMore,
  searchItunes,
  selectHasMore,
  selectShouldLoadMore,
  selectVisibleResults,
  type SearchState,
} from './searchSlice';

const results = (n: number, offset = 0): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: 'song',
    id: `song-${i + offset}`,
    title: `Song ${i + offset}`,
  }));

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
      searchItunes.fulfilled(
        { results: results(25), hasMore: true, next: 'abc.sig' },
        'req1',
        'beatles',
      ),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(25);
    expect(state.hasMore).toBe(true);
    expect(state.next).toBe('abc.sig');
    expect(state.visibleCount).toBe(PAGE_SIZE);
  });

  it('search rejected stores the error message', () => {
    const pending = reducer(undefined, searchItunes.pending('req1', 'beatles'));
    const state = reducer(
      pending,
      searchItunes.rejected(new Error('iTunes search is currently unavailable'), 'req1', 'beatles'),
    );
    expect(state.status).toBe('failed');
    expect(state.error).toBe('iTunes search is currently unavailable');
  });

  it('ignores a stale fulfilled response for a superseded term', () => {
    // Search-as-you-type: 'oas' fires, then 'oasis' — the slow 'oas' response lands last
    let state = reducer(undefined, searchItunes.pending('req1', 'oas'));
    state = reducer(state, searchItunes.pending('req2', 'oasis'));
    state = reducer(
      state,
      searchItunes.fulfilled({ results: results(5), hasMore: false }, 'req1', 'oas'),
    );
    expect(state.status).toBe('loading'); // still waiting on the current term
    expect(state.results).toHaveLength(0);

    state = reducer(
      state,
      searchItunes.fulfilled({ results: results(3), hasMore: false }, 'req2', 'oasis'),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(3);
  });

  it('ignores a stale rejection for a superseded term', () => {
    let state = reducer(undefined, searchItunes.pending('req1', 'oas'));
    state = reducer(state, searchItunes.pending('req2', 'oasis'));
    state = reducer(state, searchItunes.rejected(new Error('boom'), 'req1', 'oas'));
    expect(state.status).toBe('loading');
    expect(state.error).toBeUndefined();
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
    const state = reducer(
      pending,
      loadMore.fulfilled({ results: refetched, hasMore: false }, 'req2'),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results.slice(0, 20)).toEqual(prior.results); // untouched
    expect(state.results).toHaveLength(30); // 20 kept + 10 genuinely new
    expect(state.hasMore).toBe(false);
    expect(state.next).toBeUndefined(); // upstream exhausted — no further cursor
    expect(state.visibleCount).toBe(PAGE_SIZE); // loading more never reveals
  });

  it('ignores a stale loadMore fulfilled that lands after a new search', () => {
    // A loadMore is in flight when the user searches something new
    let state = reducer(succeeded(20, true), loadMore.pending('load1'));
    state = reducer(state, searchItunes.pending('req2', 'oasis'));
    state = reducer(
      state,
      searchItunes.fulfilled(
        { results: results(5, 100), hasMore: true, next: 'oasis-cursor' },
        'req2',
        'oasis',
      ),
    );

    // The old term's batch lands last: it must not pollute the list or cursor
    state = reducer(
      state,
      loadMore.fulfilled({ results: results(10, 40), hasMore: false }, 'load1'),
    );
    expect(state.results).toHaveLength(5);
    expect(state.hasMore).toBe(true);
    expect(state.next).toBe('oasis-cursor');
  });

  it('ignores a stale loadMore rejection that lands during a new search', () => {
    let state = reducer(succeeded(20, true), loadMore.pending('load1'));
    state = reducer(state, searchItunes.pending('req2', 'oasis'));
    state = reducer(state, loadMore.rejected(new Error('boom'), 'load1'));

    // The new search must keep loading unharmed, with its paging intact
    expect(state.status).toBe('loading');
    expect(state.error).toBeUndefined();
  });

  it('only the in-flight loadMore may settle: an older request is ignored', () => {
    // Old loadMore still in flight; a new search completes and prefetches its own
    let state = reducer(succeeded(20, true), loadMore.pending('load1'));
    state = reducer(state, searchItunes.pending('req2', 'oasis'));
    state = reducer(
      state,
      searchItunes.fulfilled(
        { results: results(15, 100), hasMore: true, next: 'oasis-40' },
        'req2',
        'oasis',
      ),
    );
    state = reducer(state, loadMore.pending('load2'));

    // The OLD term's loadMore settles while the new one is still in flight
    state = reducer(
      state,
      loadMore.fulfilled({ results: results(10, 40), hasMore: false }, 'load1'),
    );
    expect(state.results).toHaveLength(15); // untouched
    expect(state.status).toBe('loadingMore'); // still waiting on the live request

    // The live request settles normally
    state = reducer(
      state,
      loadMore.fulfilled({ results: results(20, 100), hasMore: false }, 'load2'),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(20);
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

describe('selectors', () => {
  // Selectors take root state: the slice lives under the 'search' key
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
    expect(
      selectShouldLoadMore(
        wrap({ ...succeeded(25, true), visibleCount: 20, status: 'loadingMore' }),
      ),
    ).toBe(false); // already loading
  });
});
