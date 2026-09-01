import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEBOUNCE_MS } from './components/SearchForm';
import { makeStore } from './store';
import { MockIntersectionObserver } from './test/mockIntersectionObserver';
import type { SearchResult } from '../shared/types';
import ThemeProvider from './components/ThemeProvider';

/** n results cycling through the three kinds so badges are always present. */
const makeResults = (n: number): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    // Cycle through the three kinds (artist, album, song) for each result
    // Divide the index by 3 and use the remainder to select the kind from the KIND_ORDER array
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
    // Extract the cursor parameter from the URL's query string
    const cursor = new URL(url, 'http://localhost').searchParams.get('cursor');

    // Call the respond function with the extracted cursor to get the mock response
    return { ok: true, status: 200, json: async () => respond(cursor) };
  });

  // Stub the global fetch function with the mock implementation to intercept network requests
  vi.stubGlobal('fetch', fetchMock);

  // Return the fetchMock so that tests can assert on its calls and behavior
  return fetchMock;
};

/** One fixed page regardless of cursor, with no more upstream. */
const singleBatch = (results: SearchResult[]) => () => ({ results, hasMore: false });

const renderApp = () =>
  render(
    <Provider store={makeStore()}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Provider>,
  );

/** Types a term into the search box. */
const search = async (term: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('searchbox'), term);
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

    // The first batch is revealed immediately, and the prefetch fires while the sentinel is still in view
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    // Wait for the prefetch to complete and assert that the fetchMock was called twice (initial search + prefetch)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('cursor=cursor-40');

    // The appended batch is revealable on the next intersect
    const observer = MockIntersectionObserver.instances.at(-1)!;
    const { act } = await import('react');
    act(() => observer.trigger());

    // Assert that the total number of list items is now 20 (10 initial + 10 revealed from the prefetched batch)
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

  it('searches automatically once typing pauses, without a submit', async () => {
    const fetchMock = stubFetch(singleBatch(makeResults(5)));
    vi.useFakeTimers();
    try {
      // Render the app and get the search input element
      renderApp();
      const input = screen.getByRole('searchbox');

      // Keystrokes arriving faster than the pause keep resetting the timer
      fireEvent.change(input, { target: { value: 'radio' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS - 100));
      fireEvent.change(input, { target: { value: 'radiohead' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS - 100));
      expect(fetchMock).not.toHaveBeenCalled();

      // One request once typing pauses long enough
      act(() => vi.advanceTimersByTime(100));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('term=radiohead');
    } finally {
      vi.useRealTimers();
    }
    expect(await screen.findByRole('list', { name: /search results/i })).toBeInTheDocument();
  });

  it('does not auto-search single-character terms', () => {
    const fetchMock = stubFetch(singleBatch(makeResults(5)));
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'r' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 2));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('submit searches immediately and the pending debounce does not duplicate it', () => {
    const fetchMock = stubFetch(singleBatch(makeResults(5)));
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'oasis' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 2));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // The armed debounce timer must not fire a second identical search
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 2));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'iTunes search is currently unavailable',
    );
  });
});
