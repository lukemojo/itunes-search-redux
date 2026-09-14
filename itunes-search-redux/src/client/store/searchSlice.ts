import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import type { SearchResponse, SearchResult } from '../../shared/types';

/** How many results are revealed at a time, starting with the first page. */
export const PAGE_SIZE = 10;

/** The whole search feature's state: one result set and a reveal window over it. */
export interface SearchState {
  term: string;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  /** Every result the last successful search returned. */
  results: SearchResult[];
  /** How many of `results` are revealed; grows by PAGE_SIZE per reveal. */
  visibleCount: number;
  error?: string;
}

/** Initial state for the search feature. */
const initialState: SearchState = {
  term: '',
  status: 'idle',
  results: [],
  visibleCount: PAGE_SIZE,
};

/** Fetches a term's results from the BFF, surfacing the server's error message. */
async function fetchSearch(term: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ term });
  const res = await fetch(`/api/search?${params}`);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }

  return (await res.json()) as SearchResponse;
}

/** Runs a search, replacing whatever was shown before. */
export const searchItunes = createAsyncThunk<SearchResponse, string>(
  'search/searchItunes',
  (term) => fetchSearch(term),
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    /** Reveals another page of already-loaded results, capped at what's loaded. */
    revealMore(state) {
      state.visibleCount = Math.min(state.visibleCount + PAGE_SIZE, state.results.length);
    },
    /** Clear results and errors when the search box is emptied. */
    clearSearch() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchItunes.pending, (state, action) => {
        state.status = 'loading';
        state.term = action.meta.arg;
        state.results = [];
        state.visibleCount = PAGE_SIZE;
        state.error = undefined;
      })
      .addCase(searchItunes.fulfilled, (state, action) => {
        // Debounced typing overlaps requests: drop any response for a term
        // that is no longer the one being searched (last-pending wins).
        if (action.meta.arg !== state.term) return;
        state.status = 'succeeded';
        state.results = action.payload.results;
      })
      .addCase(searchItunes.rejected, (state, action) => {
        if (action.meta.arg !== state.term) return; // stale failure — ignore
        state.status = 'failed';
        state.error = action.error.message ?? 'Search failed';
      });
  },
});

export const { revealMore, clearSearch } = searchSlice.actions;
export default searchSlice.reducer;

/** The root-state shape this slice's selectors need (the slice mounts under 'search'). */
interface WithSearch {
  search: SearchState;
}

/** The search lifecycle status driving which view SearchResults renders. */
export const selectStatus = (state: WithSearch) => state.search.status;
/** The term currently being (or last) searched. */
export const selectTerm = (state: WithSearch) => state.search.term;
/** The most recent search error message, if any. */
export const selectError = (state: WithSearch) => state.search.error;
/** How many results the search returned in total, revealed or not. */
export const selectTotalCount = (state: WithSearch) => state.search.results.length;
/** True while loaded results remain unrevealed. */
export const selectHasMore = (state: WithSearch) =>
  state.search.visibleCount < state.search.results.length;

/**
 * The revealed window over the loaded results. Memoized: slice() makes a new
 * array, and useSelector treats a fresh reference as a change (re-renders).
 */
export const selectVisibleResults = createSelector(
  [(state: WithSearch) => state.search.results, (state: WithSearch) => state.search.visibleCount],
  (results, visibleCount) => results.slice(0, visibleCount),
);
