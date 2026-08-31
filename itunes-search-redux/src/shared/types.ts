export type ResultKind = 'artist' | 'album' | 'song';

/**
 * Represents a single search result from the iTunes API.
 */
export interface SearchResult {
  /** The kind of result, which can be 'artist', 'album', or 'song'. */
  kind: ResultKind;
  /** The unique identifier for the result. */
  id: string;
  /** The title of the result. */
  title: string;
  /** The subtitle of the result, if available. */
  subtitle?: string;
  /** The URL of the artwork image for the result, if available. */
  artworkUrl?: string;
}

/**
 * Represents the response from the iTunes API for a search query.
 */
export interface SearchResponse {
  /** The array of search results. */
  results: SearchResult[];
  /** True while refetching with a larger limit may yield more results. */
  hasMore: boolean;
  /** Opaque signed cursor for the next batch; present only while hasMore. */
  next?: string;
}
