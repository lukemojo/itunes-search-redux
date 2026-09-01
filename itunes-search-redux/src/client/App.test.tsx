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

    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    // Initial search + prefetch
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('cursor=cursor-40');

    // The appended batch is revealable on the next intersect
    const observer = MockIntersectionObserver.instances.at(-1)!;
    const { act } = await import('react');
    act(() => observer.trigger());

    // 10 initial + 10 revealed from the prefetched batch
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });

  it('announces "more than" the visible count while more results exist', async () => {
    stubFetch(singleBatch(makeResults(25)));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    // 10 of 25 revealed — unrevealed items still count as "more"
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 10 of more than 10 results for “radiohead”',
    );
  });

  it('announces the exact count once everything is revealed and upstream is exhausted', async () => {
    stubFetch(singleBatch(makeResults(25)));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    // Reveal the remaining 15 via the Load more button
    const button = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.getAllByRole('listitem')).toHaveLength(25);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 25 of 25 results for “radiohead”',
    );
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

  it('Enter searches immediately and the pending debounce does not duplicate it', () => {
    const fetchMock = stubFetch(singleBatch(makeResults(5)));
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'oasis' } });

      // Enter fires the form's submit event: search immediately, no debounce wait
      fireEvent.submit(screen.getByRole('search'));
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

  it('a failed search can be retried with Enter for the same term', async () => {
    // First call fails, subsequent calls succeed
    type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
    const fetchMock = vi
      .fn(async (): Promise<FetchResponse> => ({
        ok: true,
        status: 200,
        json: async () => ({ results: makeResults(5), hasMore: false }),
      }))
      .mockImplementationOnce(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: 'iTunes search is currently unavailable' }),
      }));
    vi.stubGlobal('fetch', fetchMock);
    renderApp();
    await search('radiohead');
    await screen.findByRole('alert');

    // Same term, but the failure must not leave the user stuck on the error
    fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByRole('list', { name: /search results/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resets to initial state on input clear', async () => {
    const fetchMock = stubFetch(singleBatch(makeResults(5)));
    vi.useFakeTimers();
    try {
      renderApp();
      const input = screen.getByRole('searchbox');

      fireEvent.change(input, { target: { value: 'radiohead' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS + 100));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('term=radiohead');

      fireEvent.change(input, { target: { value: '' } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_MS + 100));
    } finally {
      vi.useRealTimers();
    }
    expect(screen.queryByRole('list', { name: /search results/i })).not.toBeInTheDocument();
  });
});
