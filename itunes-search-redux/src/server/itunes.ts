import type { SearchResponse, SearchResult } from '../shared/types.js';

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

const ITUNES_URL = 'https://itunes.apple.com/search';
const ENTITIES = ['musicArtist', 'album', 'song'] as const;
const UPSTREAM_TIMEOUT_MS = 8000;

/** iTunes rejects limits above 200, so paging stops there. */
export const MAX_LIMIT = 200;

/**
 * Searches iTunes for a term with three parallel entity-scoped calls
 * (musicArtist, album, song), then normalizes the set.
 * `limit` is per entity; `hasMore` means refetching with a larger limit may
 * yield more.
 * Refetch acts as pagination as there is no valid pagination mechanism.
 * Must run server-side: iTunes CORS-blocks browsers. Each upstream call is
 * abandoned after 8s via AbortSignal.timeout.
 */
export async function searchItunes(term: string, limit = 20) {
  const payloads = await Promise.all(
    ENTITIES.map(async (entity) => {
      // Build the URL with query parameters for the iTunes Search API
      const params = new URLSearchParams({ term, entity, limit: limit.toString() });

      // Fetch the results from iTunes with a timeout
      const res = await fetch(`${ITUNES_URL}?${params}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      // If the response is not OK, throw an error with the status code
      if (!res.ok) throw new Error(`iTunes responded with ${res.status}`);

      // Parse the JSON response and extract the results array, defaulting to an empty array if not present
      const body = (await res.json()) as { results?: RawItunesItem[] };
      return body.results ?? [];
    }),
  );

  // A full raw page from any entity means a larger limit may yield more
  const hasMore = limit < MAX_LIMIT && payloads.some((items) => items.length >= limit);

  // Normalize the raw iTunes items to our SearchResult type, filtering out any nulls
  const normalized = payloads
    .flat()
    .map(normalizeItem)
    .filter((result): result is SearchResult => result !== null);

  // Return the normalized results in the same order they were received, along with the hasMore flag
  const data: SearchResponse = { results: normalized, hasMore };

  return data;
}
