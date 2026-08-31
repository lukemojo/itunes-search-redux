import { Router } from 'express';
import type { SearchResponse } from '../../shared/types.js';
import { createCursor, readCursor } from '../cursor.js';
import { MAX_LIMIT } from '../itunes.js';

/**
 * The search implementation the route delegates to — injected so route tests
 * exercise HTTP semantics without touching the network.
 */
export type Searcher = (term: string, limit: number) => Promise<SearchResponse>;

/** A fresh search always starts here; each next cursor advances by STEP. */
const DEFAULT_LIMIT = 20;
const STEP = 20;

/**
 * GET /search?term=x[&cursor=…] — validates input (400), delegates to the
 * searcher, and maps any upstream failure to a clean 502. The per-entity limit
 * never appears in the API: clients echo the signed `next` cursor from the
 * previous response, so paging policy stays server-owned.
 */
export function createSearchRouter(search: Searcher) {
  // Create a new Express router instance
  const router = Router();

  // Define a GET route for '/search' that handles search requests
  router.get('/search', async (req, res) => {
    // Extract and validate the 'term' query parameter from the request
    const term = typeof req.query.term === 'string' ? req.query.term.trim() : '';

    // If the 'term' parameter is missing or empty, respond with a 400 Bad Request error
    if (!term) {
      res.status(400).json({ error: 'Query parameter "term" is required' });
      return;
    }

    // Extract and validate the 'cursor' query parameter, if present, to determine the limit for the search
    const rawCursor = req.query.cursor;

    // Set the default limit for the search results
    let limit = DEFAULT_LIMIT;

    // If a cursor is provided, attempt to read it and set the limit accordingly. 
    // If the cursor is invalid, respond with a 400 Bad Request error.
    if (rawCursor !== undefined) {
      const cursorLimit = typeof rawCursor === 'string' ? readCursor(rawCursor) : null;
      if (cursorLimit === null) {
        res.status(400).json({ error: 'Query parameter "cursor" is invalid' });
        return;
      }
      limit = cursorLimit;
    }

    try {
      // Call the search function with the validated term and limit
      const { results, hasMore } = await search(term, limit);

      // Respond with the search results, hasMore flag, and a next cursor if applicable
      res.json({
        results,
        hasMore,
        ...(hasMore ? { next: createCursor(Math.min(limit + STEP, MAX_LIMIT)) } : {}),
      } satisfies SearchResponse);
    } catch {
      res.status(502).json({ error: 'iTunes search is currently unavailable' });
    }
  });

  return router;
}
