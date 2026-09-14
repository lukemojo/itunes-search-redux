import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEBOUNCE_MS } from './components/SearchForm';
import ThemeProvider from './components/ThemeProvider';
import { makeStore } from './store';
import { PAGE_SIZE } from './store/searchSlice';
import { MockIntersectionObserver } from './test/mockIntersectionObserver';
import type { SearchResult } from '../shared/types';

/** n results cycling through the three kinds so badges are always present. */
const makeResults = (n: number): SearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: (['artist', 'album', 'song'] as const)[i % 3]!,
    id: `id-${i}`,
    title: `Result ${i}`,
    subtitle: `Sub ${i}`,
  }));

/** Stubs fetch so every /api/search call answers with the same fixed set. */
const stubFetch = (results: SearchResult[]) => {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ results }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

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
  it('shows the first page of results with kind badges after a search', async () => {
    stubFetch(makeResults(25));
    renderApp();
    await search('radiohead');

    const list = await screen.findByRole('list', { name: /search results/i });
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE);
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Album').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Song').length).toBeGreaterThan(0);
    expect(list).toBeInTheDocument();
  });

  it('fetches once per search — the whole result set arrives in one response', async () => {
    const fetchMock = stubFetch(makeResults(25));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/search?term=radiohead');
  });

  it('reveals another page when the sentinel intersects', async () => {
    stubFetch(makeResults(25));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    const observer = MockIntersectionObserver.instances.at(-1)!;
    act(() => observer.trigger());

    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE * 2);
  });

  it('announces how many of the total are showing', async () => {
    stubFetch(makeResults(25));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 10 of 25 results for “radiohead”',
    );
  });

  it('Load more reveals the remainder and then stops being rendered', async () => {
    stubFetch(makeResults(15));
    renderApp();
    await search('radiohead');
    await screen.findByRole('list', { name: /search results/i });

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(15);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 15 of 15 results for “radiohead”',
    );

    // Nothing left to reveal: the button must not linger as a dead control
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('notifies the user when there are no results', async () => {
    stubFetch([]);
    renderApp();
    await search('zzzzzz');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/no results found for/i);
    expect(status).toHaveTextContent('zzzzzz');
  });

  it('searches automatically once typing pauses, without a submit', async () => {
    const fetchMock = stubFetch(makeResults(5));
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
    const fetchMock = stubFetch(makeResults(5));
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
    const fetchMock = stubFetch(makeResults(5));
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
        json: async () => ({ results: makeResults(5) }),
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
    const fetchMock = stubFetch(makeResults(5));
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
