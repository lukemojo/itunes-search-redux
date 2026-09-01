import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { SearchResponse, SearchResult } from '../shared/types.js';

/**
 * A sample search result used for testing purposes
 */
const sample: SearchResult[] = [
  { kind: 'song', id: 'song-1', title: 'Karma Police', subtitle: 'Radiohead' },
];

/**
 * Creates a mock search function that returns a predefined set of results and an optional hasMore flag.
 * @param results - The array of SearchResult objects to return.
 * @param hasMore - A boolean indicating whether there are more results available (default: false).
 * @returns A mock function that simulates the search behavior.
 */
const respond = (results: SearchResult[], hasMore = false) =>
  vi.fn(async (): Promise<SearchResponse> => ({ results, hasMore }));

describe('GET /api/search', () => {
  it('starts at limit 20 and hands out an opaque next cursor while hasMore', async () => {
    const search = respond(sample, true);
    const res = await request(createApp(search)).get('/api/search').query({ term: 'radiohead' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: sample, hasMore: true, next: expect.any(String) });
    expect(search).toHaveBeenCalledWith('radiohead', 20);
  });

  it('echoing the next cursor advances the limit server-side (20 → 40 → 60)', async () => {
    const search = respond(sample, true);
    const app = createApp(search);

    const first = await request(app).get('/api/search').query({ term: 'radiohead' });
    const second = await request(app)
      .get('/api/search')
      .query({ term: 'radiohead', cursor: first.body.next });
    expect(search).toHaveBeenLastCalledWith('radiohead', 40);

    await request(app).get('/api/search').query({ term: 'radiohead', cursor: second.body.next });
    expect(search).toHaveBeenLastCalledWith('radiohead', 60);
  });

  it('omits the next cursor when there is no more upstream', async () => {
    const res = await request(createApp(respond(sample, false)))
      .get('/api/search')
      .query({ term: 'radiohead' });
    expect(res.body).toEqual({ results: sample, hasMore: false });
  });

  it('ignores any limit param a client tries to pass directly', async () => {
    const search = respond(sample);
    await request(createApp(search)).get('/api/search').query({ term: 'radiohead', limit: '200' });
    expect(search).toHaveBeenCalledWith('radiohead', 20);
  });

  it('returns 400 when term is missing or blank', async () => {
    const app = createApp(respond(sample));
    expect((await request(app).get('/api/search')).status).toBe(400);

    const res = await request(app).get('/api/search').query({ term: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/term/i);
  });

  it('returns 400 for a fabricated or tampered cursor', async () => {
    const app = createApp(respond(sample, true));
    const first = await request(app).get('/api/search').query({ term: 'x' });
    const signature = (first.body.next as string).split('.')[1]!;

    for (const cursor of ['garbage', '200', `200.${signature}`]) {
      const res = await request(app).get('/api/search').query({ term: 'x', cursor });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cursor/i);
    }
  });

  it('returns 502 with a clean body when upstream fails', async () => {
    const search = vi.fn(async (): Promise<SearchResponse> => {
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
    expect(res.body).toEqual({ results: [], hasMore: false });
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
