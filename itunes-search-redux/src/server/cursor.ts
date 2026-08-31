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
  // Split the token into payload and signature parts
  const [payload, signature] = token.split('.');

  // If either part is missing, return null to indicate an invalid cursor
  if (!payload || !signature) return null;

  // Verify the signature using a timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(sign(payload), 'base64url');
  const received = Buffer.from(signature, 'base64url');

  // If the lengths differ or the signatures don't match, return null to indicate an invalid cursor
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  // Convert the payload to a number and validate it against the allowed range
  const limit = Number(payload);

  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}
