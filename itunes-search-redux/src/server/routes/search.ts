import { Router } from 'express';
import type { SearchResponse, SearchResult } from '../../shared/types.js';

/**
 * The search implementation the route delegates to — injected so route tests
 * exercise HTTP semantics without touching the network.
 */
export type Searcher = (term: string) => Promise<SearchResult[]>;

/**
 * GET /search?term=x — validates input (400), delegates to the searcher, and
 * maps any upstream failure to a clean 502. One request returns the whole
 * result set; how much of it the user sees at a time is the client's business.
 */
export function createSearchRouter(search: Searcher) {
  const router = Router();

  router.get('/search', async (req, res) => {
    const term = typeof req.query.term === 'string' ? req.query.term.trim() : '';
    if (!term) {
      res.status(400).json({ error: 'Query parameter "term" is required' });
      return;
    }

    try {
      const results = await search(term);
      res.json({ results } satisfies SearchResponse);
    } catch {
      res.status(502).json({ error: 'iTunes search is currently unavailable' });
    }
  });

  return router;
}
