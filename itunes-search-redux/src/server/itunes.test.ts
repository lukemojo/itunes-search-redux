import { describe, expect, it } from 'vitest';
import { normalizeItem } from './itunes.js';

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
