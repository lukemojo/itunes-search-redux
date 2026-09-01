import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mswServer } from '../mocks/node.js';
import { normalizeItem, searchItunes } from './itunes.js';

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

describe('searchItunes', () => {
  it('fans out to three entities and returns a merged set', async () => {
    // MSW's events API records the real outbound URLs so the fan-out is observable
    const requestedUrls: URL[] = [];
    const listener = ({ request }: { request: Request }) => {
      requestedUrls.push(new URL(request.url));
    };
    mswServer.events.on('request:start', listener);

    const { hasMore } = await searchItunes('radiohead');

    expect(requestedUrls).toHaveLength(3);
    expect(requestedUrls.map((u) => u.searchParams.get('entity')).sort()).toEqual([
      'album',
      'musicArtist',
      'song',
    ]);
    expect(requestedUrls.every((u) => u.searchParams.get('term') === 'radiohead')).toBe(true);
    expect(requestedUrls.every((u) => u.searchParams.get('limit') === '20')).toBe(true);

    // No entity filled its 20-item page, so there is nothing more upstream
    expect(hasMore).toBe(false);

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
