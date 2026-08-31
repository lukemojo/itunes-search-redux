import path from 'node:path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { searchItunes } from './itunes.js';
import { createSearchRouter, type Searcher } from './routes/search.js';

/**
 * Builds the Express app: security headers, compression, the API routes, and
 * static serving of the built client. The searcher is injectable so supertest
 * can drive the HTTP layer without the network.
 */
export function createApp(search: Searcher = searchItunes): express.Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Album/track artwork is served from Apple's CDN
          'img-src': ["'self'", 'data:', 'https://*.mzstatic.com'],
          // styled-components injects inline <style> at runtime
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  // Enable gzip compression for all responses to improve performance
  app.use(compression());

  // Health check endpoint to verify that the server is running
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount the search router at the '/api' path, delegating search requests to the provided searcher
  app.use('/api', createSearchRouter(search));

  // From dist/server/app.js, ../client is the Vite build (dist/client).
  const clientDist = path.resolve(import.meta.dirname, '../client');
  app.use(express.static(clientDist));

  // Express 5 removed '*' wildcards; a plain use() is the SPA index fallback.
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
