import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MAX_LIMIT } from './itunes.js';

// Per-boot secret: zero config, and a restart invalidating in-flight cursors
// is harmless — the client keeps what it has shown and simply stops paging.
const SECRET = randomBytes(32);

/**
 * Signs a payload with the server secret, returning a base64url string.
 */
const sign = (payload: string): string =>
  createHmac('sha256', SECRET).update(payload).digest('base64url');

/**
 * Wraps a per-entity limit in an opaque signed token. Clients echo it back
 * verbatim, so paging policy (start, step, cap) stays server-owned and a
 * client can't request an arbitrary limit.
 */
export function createCursor(limit: number): string {
  const payload = String(limit);
  return `${payload}.${sign(payload)}`;
}

/**
 * Verifies a cursor and returns the limit it embeds, or null for anything
 * tampered, malformed, or out of range — the route treats null as a 400.
 */
export function readCursor(token: string): number | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  const limit = Number(payload);
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}
