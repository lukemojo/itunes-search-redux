import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mswServer } from '../mocks/node.js';
import type { SearchResult } from '../shared/types.js';
import { interleave, normalizeItem, searchItunes } from './itunes.js';

describe('normalizeItem', () => {
  it('normalizes an artist', () => {
    expect(
      normalizeItem({
        wrapperType: 'artist',
        artistId: 1,
        artistName: 'Radiohead',
        primaryGenreName: 'Alternative',
      }),
    ).toEqual({ kind: 'artist', id: 'artist-1', title: 'Radiohead', subtitle: 'Alternative' });
  });

  it('normalizes an album (collection)', () => {
    expect(
      normalizeItem({
        wrapperType: 'collection',
        collectionId: 2,
        collectionName: 'OK Computer',
        artistName: 'Radiohead',
        artworkUrl100: 'https://img/ok.jpg',
      }),
    ).toEqual({
      kind: 'album',
      id: 'album-2',
      title: 'OK Computer',
      subtitle: 'Radiohead',
      artworkUrl: 'https://img/ok.jpg',
    });
  });

  it('normalizes a song (track with kind "song")', () => {
    expect(
      normalizeItem({
        wrapperType: 'track',
        kind: 'song',
        trackId: 3,
        trackName: 'Karma Police',
        artistName: 'Radiohead',
        artworkUrl100: 'https://img/kp.jpg',
      }),
    ).toEqual({
      kind: 'song',
      id: 'song-3',
      title: 'Karma Police',
      subtitle: 'Radiohead',
      artworkUrl: 'https://img/kp.jpg',
    });
  });

  it('rejects non-music tracks: wrapperType "track" alone does not mean song', () => {
    // Real payloads return movies and TV episodes as wrapperType "track"
    expect(
      normalizeItem({
        wrapperType: 'track',
        kind: 'feature-movie',
        trackId: 9,
        trackName: 'Thicker Than Water',
      }),
    ).toBeNull();
    expect(
      normalizeItem({
        wrapperType: 'track',
        kind: 'tv-episode',
        trackId: 10,
        trackName: 'Unforgivable Blackness',
      }),
    ).toBeNull();
  });

  it('returns null for unknown wrapper types or missing essentials', () => {
    expect(
      normalizeItem({
        wrapperType: 'audiobook',
        collectionId: 5,
        collectionName: 'A Rare Recording',
      }),
    ).toBeNull();
    expect(normalizeItem({ wrapperType: 'artist' })).toBeNull(); // no id/name
    expect(normalizeItem({})).toBeNull();
  });
});

const searchResult = (kind: SearchResult['kind'], n: number): SearchResult => ({
  kind,
  id: `${kind}-${n}`,
  title: `${kind} ${n}`,
});

describe('interleave', () => {
  it('round-robins artist, album, song', () => {
    const interleavedResult = interleave([
      searchResult('song', 1),
      searchResult('song', 2),
      searchResult('artist', 1),
      searchResult('album', 1),
    ]);
    expect(interleavedResult.map((x) => x.id)).toEqual(['artist-1', 'album-1', 'song-1', 'song-2']);
  });

  it('handles a single kind and empty input', () => {
    expect(
      interleave([searchResult('album', 1), searchResult('album', 2)]).map((x) => x.id),
    ).toEqual(['album-1', 'album-2']);
    expect(interleave([])).toEqual([]);
  });
});

describe('searchItunes', () => {
  it('fans out to three entities and returns a merged, interleaved set', async () => {
    // Capture the requested URLs so we can assert on them later
    const requestedUrls: URL[] = [];

    // Listener function to capture the requested URLs
    const listener = ({ request }: { request: Request }) => {
      requestedUrls.push(new URL(request.url));
    };

    // Use the MSW server to capture requests and record their URLs
    mswServer.events.on('request:start', listener);

    // Call the searchItunes function with a test term
    const { results, hasMore } = await searchItunes('radiohead');

    // Assert that three requests were made, one for each entity type
    expect(requestedUrls).toHaveLength(3);

    // Assert that the requested entity types are as expected and that the term and limit parameters are correct
    expect(requestedUrls.map((u) => u.searchParams.get('entity')).sort()).toEqual([
      'album',
      'musicArtist',
      'song',
    ]);

    // Assert that the term and limit parameters are correct for all requests
    expect(requestedUrls.every((u) => u.searchParams.get('term') === 'radiohead')).toBe(true);
    expect(requestedUrls.every((u) => u.searchParams.get('limit') === '20')).toBe(true);

    // Assert that the results are interleaved correctly based on the mocked data
    expect(results.map((x) => x.kind)).toEqual(['artist', 'album', 'song']);

    // No entity filled its 20-item page, so there is nothing more upstream
    expect(hasMore).toBe(false);

    // Remove the listener after the test to avoid side effects
    mswServer.events.removeListener('request:start', listener);
  });

  it('passes the limit through and reports hasMore when any entity fills its page', async () => {
    const requestedUrls: URL[] = [];
    const listener = ({ request }: { request: Request }) => {
      requestedUrls.push(new URL(request.url));
    };
    mswServer.events.on('request:start', listener);

    // Each default handler returns exactly 1 item, so limit=1 pages are full
    const { hasMore } = await searchItunes('radiohead', 1);

    expect(requestedUrls.every((u) => u.searchParams.get('limit') === '1')).toBe(true);
    expect(hasMore).toBe(true);

    mswServer.events.removeListener('request:start', listener);
  });

  it('reports hasMore false at the 200 cap even when pages are full', async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      wrapperType: 'track',
      kind: 'song',
      trackId: i,
      trackName: `Song ${i}`,
    }));
    mswServer.use(
      http.get('https://itunes.apple.com/search', () =>
        HttpResponse.json({ resultCount: fullPage.length, results: fullPage }),
      ),
    );

    const { hasMore } = await searchItunes('radiohead', 200);

    expect(hasMore).toBe(false);
  });

  it('throws when any upstream call is not ok', async () => {
    mswServer.use(
      http.get('https://itunes.apple.com/search', () => new HttpResponse(null, { status: 503 })),
    );
    await expect(searchItunes('x')).rejects.toThrow(/503/);
  });
});
