import type { SearchResult } from '../shared/types.js';

/**
 * The subset of an iTunes Search API result. 
 * I have left the type deliberately loose and discriminate during normalization.
 */
export interface RawItunesItem {
  wrapperType?: string; // we're interested in 'artist', 'collection', and 'track' for discrimination
  kind?: string; // for tracks, we're only interested in 'song', ignoring movies and TV episodes
  artistId?: number;
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
  trackId?: number;
  trackName?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
}

/**
 * Maps one raw iTunes item to our SearchResult, or null for anything that
 * isn't a music artist, album, or song
 */
export function normalizeItem(item: RawItunesItem): SearchResult | null {
  switch (item.wrapperType) {
    case 'artist':
      if (item.artistId === undefined || !item.artistName) return null;
      return {
        kind: 'artist',
        id: `artist-${item.artistId}`,
        title: item.artistName,
        ...(item.primaryGenreName ? { subtitle: item.primaryGenreName } : {}),
      };
    case 'collection':
      if (item.collectionId === undefined || !item.collectionName) return null;
      return {
        kind: 'album',
        id: `album-${item.collectionId}`,
        title: item.collectionName,
        ...(item.artistName ? { subtitle: item.artistName } : {}),
        ...(item.artworkUrl100 ? { artworkUrl: item.artworkUrl100 } : {}),
      };
    case 'track':
      if (item.kind !== 'song' || item.trackId === undefined || !item.trackName) return null;
      return {
        kind: 'song',
        id: `song-${item.trackId}`,
        title: item.trackName,
        ...(item.artistName ? { subtitle: item.artistName } : {}),
        ...(item.artworkUrl100 ? { artworkUrl: item.artworkUrl100 } : {}),
      };
    default:
      return null;
  }
}
