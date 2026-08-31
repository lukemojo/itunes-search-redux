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
