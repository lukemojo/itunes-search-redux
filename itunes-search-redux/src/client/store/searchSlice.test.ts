import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../../shared/types';
import reducer, {
  PAGE_SIZE,
  clearSearch,
  revealMore,
  searchItunes,
  selectHasMore,
  selectVisibleResults,
  type SearchState,
} from './searchSlice';

const results = (n: number, offset = 0): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: 'song',
    id: `song-${i + offset}`,
    title: `Song ${i + offset}`,
  }));

const succeeded = (n: number): SearchState => ({
  term: 'beatles',
  status: 'succeeded',
  results: results(n),
  visibleCount: PAGE_SIZE,
});

describe('searchSlice', () => {
  it('search pending resets results, error and visibleCount, and stores the term', () => {
    const prior: SearchState = { ...succeeded(30), visibleCount: 30, error: 'old' };
    const state = reducer(prior, searchItunes.pending('req1', 'oasis'));
    expect(state).toEqual({
      term: 'oasis',
      status: 'loading',
      results: [],
      visibleCount: PAGE_SIZE,
      error: undefined,
    });
  });

  it('search fulfilled stores the results and starts the reveal window at one page', () => {
    const pending = reducer(undefined, searchItunes.pending('req1', 'beatles'));
    const state = reducer(
      pending,
      searchItunes.fulfilled({ results: results(25) }, 'req1', 'beatles'),
    );
    expect(state.status).toBe('succeeded');
    expect(state.results).toHaveLength(25);
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
    state = reducer(state, searchItunes.fulfilled({ results: results(5) }, 'req1', 'oas'));
    expect(state.status).toBe('loading'); // still waiting on the current term
    expect(state.results).toHaveLength(0);

    state = reducer(state, searchItunes.fulfilled({ results: results(3) }, 'req2', 'oasis'));
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
    expect(reducer(succeeded(100), revealMore()).visibleCount).toBe(PAGE_SIZE * 2);
    expect(reducer(succeeded(15), revealMore()).visibleCount).toBe(15);
    expect(reducer(succeeded(4), revealMore()).visibleCount).toBe(4);
  });

  it('clearSearch returns to the initial state', () => {
    expect(reducer(succeeded(30), clearSearch())).toEqual({
      term: '',
      status: 'idle',
      results: [],
      visibleCount: PAGE_SIZE,
    });
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

  it('selectHasMore is true only while loaded results remain unrevealed', () => {
    expect(selectHasMore(wrap(succeeded(25)))).toBe(true);
    expect(selectHasMore(wrap({ ...succeeded(25), visibleCount: 25 }))).toBe(false);
    expect(selectHasMore(wrap(succeeded(4)))).toBe(false);
  });
});
