import type { ResultKind, SearchResult } from '../shared/types.js';

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

const KIND_ORDER: ResultKind[] = ['artist', 'album', 'song'];

/**
 * Round-robins results across kinds (artist, album, song) so one plentiful
 * kind can't dominate the merged list; relative order within a kind is kept.
 */
export function interleave(results: SearchResult[]) {
  // Create a bucket for each kind and fill it with the results of that kind
  const buckets: Record<ResultKind, SearchResult[]> = { artist: [], album: [], song: [] };

  // Fill the buckets with the results
  for (const result of results) buckets[result.kind].push(result);

  // Take one from each bucket in order until all buckets are empty
  const out: SearchResult[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const kind of KIND_ORDER) {
      const next = buckets[kind].shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

const ITUNES_URL = 'https://itunes.apple.com/search';
const ENTITIES = ['musicArtist', 'album', 'song'] as const;
const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * Searches iTunes for a term with three parallel entity-scoped calls
 * (musicArtist, album, song), then normalizes and interleaves the merged set.
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

  // Normalize the raw iTunes items to our SearchResult type, filtering out any nulls
  const normalized = payloads
    .flat()
    .map(normalizeItem)
    .filter((result): result is SearchResult => result !== null);

  return interleave(normalized);
}
