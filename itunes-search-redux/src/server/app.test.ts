import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { SearchResult } from '../shared/types.js';

/**
 * A sample search result used for testing purposes
 */
const sample: SearchResult[] = [
  { kind: 'song', id: 'song-1', title: 'Karma Police', subtitle: 'Radiohead' },
];

/** A stub searcher returning a fixed set, so route tests never touch the network. */
const respond = (results: SearchResult[]) => vi.fn(async (): Promise<SearchResult[]> => results);

describe('GET /api/search', () => {
  it('returns the searcher output under results', async () => {
    const search = respond(sample);
    const res = await request(createApp(search)).get('/api/search').query({ term: 'radiohead' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: sample });
    expect(search).toHaveBeenCalledWith('radiohead');
  });

  it('trims the term before searching', async () => {
    const search = respond(sample);
    await request(createApp(search)).get('/api/search').query({ term: '  radiohead  ' });
    expect(search).toHaveBeenCalledWith('radiohead');
  });

  it('returns 400 when term is missing or blank', async () => {
    const app = createApp(respond(sample));
    expect((await request(app).get('/api/search')).status).toBe(400);

    const res = await request(app).get('/api/search').query({ term: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/term/i);
  });

  it('returns 502 with a clean body when upstream fails', async () => {
    const search = vi.fn(async (): Promise<SearchResult[]> => {
      throw new Error('boom');
    });
    const res = await request(createApp(search)).get('/api/search').query({ term: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'iTunes search is currently unavailable' });
  });

  it('returns an empty result set as results: []', async () => {
    const res = await request(createApp(respond([])))
      .get('/api/search')
      .query({ term: 'zzz' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it('404s an unknown API route instead of falling through to the SPA', async () => {
    const res = await request(createApp(respond([]))).get('/api/nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports ok for the platform health check', async () => {
    const res = await request(createApp(respond([]))).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves security headers tuned for the app', async () => {
    const res = await request(createApp(respond([]))).get('/api/health');
    expect(res.headers['content-security-policy']).toContain(
      "img-src 'self' data: https://*.mzstatic.com",
    );
  });
});

describe('search engine opt-out', () => {
  it('tells crawlers not to index any response', async () => {
    const res = await request(createApp(respond([]))).get('/api/health');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('serves a deny-all robots.txt', async () => {
    const res = await request(createApp(respond([]))).get('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/plain');
    expect(res.text).toContain('Disallow: /');
  });
});
