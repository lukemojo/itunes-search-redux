import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import type { SearchResponse, SearchResult } from '../../shared/types';

/** How many merged results each scroll reveals. */
export const PAGE_SIZE = 10;

/** The whole search feature's state: one fetched-so-far list and a reveal window over it. */
export interface SearchState {
  term: string;
  status: 'idle' | 'loading' | 'loadingMore' | 'succeeded' | 'failed';
  /** Loaded so far — append-only merged by id */
  results: SearchResult[];
  /** How many of `results` are revealed; grows by PAGE_SIZE per scroll. */
  visibleCount: number;
  /** Opaque server cursor for the next batch; absent when upstream is exhausted. */
  next?: string;
  /** Server says a refetch may yield more. */
  hasMore: boolean;
  /** requestId of the in-flight loadMore */
  loadMoreRequestId?: string;
  error?: string;
}

/** Initial state for the search feature. */
const initialState: SearchState = {
  term: '',
  status: 'idle',
  results: [],
  visibleCount: PAGE_SIZE,
  hasMore: false,
};

/** Calls the BFF (Backend For Frontend), echoing the server's cursor when extending a search. */
async function fetchSearch(term: string, cursor?: string): Promise<SearchResponse> {
  // Build the query parameters for the search request, including the term and optional cursor
  const params = new URLSearchParams({ term, ...(cursor ? { cursor } : {}) });

  // Fetch the search results from the backend API and handle any errors that may occur
  const res = await fetch(`/api/search?${params}`);

  // If the response is not OK, attempt to parse the error message from the response body and throw an error
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }

  // Return the parsed JSON response as a SearchResponse object
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
    /** Reveals another page of already-loaded results, capped at what's loaded. */
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
        state.loadMoreRequestId = undefined; // orphan any in-flight loadMore
        state.error = undefined;
      })
      .addCase(searchItunes.fulfilled, (state, action) => {
        // Debounced typing overlaps requests: drop any response for a term
        // that is no longer the one being searched (last-pending wins).
        if (action.meta.arg !== state.term) return;
        state.status = 'succeeded';
        state.results = action.payload.results;
        state.hasMore = action.payload.hasMore;
        state.next = action.payload.next;
      })
      .addCase(searchItunes.rejected, (state, action) => {
        if (action.meta.arg !== state.term) return; // stale failure — ignore
        state.status = 'failed';
        state.error = action.error.message ?? 'Search failed';
      })
      .addCase(loadMore.pending, (state, action) => {
        state.status = 'loadingMore';
        state.loadMoreRequestId = action.meta.requestId;
      })
      .addCase(loadMore.fulfilled, (state, action) => {
        // Only the in-flight request may settle — a superseded batch is stale.
        if (action.meta.requestId !== state.loadMoreRequestId) return;
        state.loadMoreRequestId = undefined;
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
        if (action.meta.requestId !== state.loadMoreRequestId) return; // stale — ignore
        state.loadMoreRequestId = undefined;
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

/** The root-state shape this slice's selectors need (the slice mounts under 'search'). */
interface WithSearch {
  search: SearchState;
}

/** The search lifecycle status driving which view SearchResults renders. */
export const selectStatus = (state: WithSearch) => state.search.status;
/** The term currently being (or last) searched. */
export const selectTerm = (state: WithSearch) => state.search.term;
/** The most recent search or load-more error message, if any. */
export const selectError = (state: WithSearch) => state.search.error;

/**
 * The revealed window over the loaded results. Memoized: slice() makes a new
 * array, and useSelector treats a fresh reference as a change (re-renders).
 */
export const selectVisibleResults = createSelector(
  [(state: WithSearch) => state.search.results, (state: WithSearch) => state.search.visibleCount],
  (results, visibleCount) => results.slice(0, visibleCount),
);

/** True while scrolling can show more — unrevealed loaded items, or more upstream. */
export const selectHasMore = (state: WithSearch) =>
  state.search.visibleCount < state.search.results.length || state.search.hasMore;

/**
 * True when under a page of loaded headroom remains, the server reports more,
 * and no load is in flight — the prefetch trigger.
 */
export const selectShouldLoadMore = (state: WithSearch) =>
  state.search.status === 'succeeded' &&
  state.search.hasMore &&
  state.search.results.length - state.search.visibleCount <= PAGE_SIZE;
