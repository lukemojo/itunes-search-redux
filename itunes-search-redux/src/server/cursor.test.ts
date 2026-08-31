import { describe, expect, it } from 'vitest';
import { createCursor, readCursor } from './cursor.js';

describe('cursor', () => {
  it('round-trips a limit through an opaque token', () => {
    expect(readCursor(createCursor(40))).toBe(40);
    expect(readCursor(createCursor(200))).toBe(200);
  });

  it('rejects tampered payloads', () => {
    const token = createCursor(40);
    const signature = token.split('.')[1]!;
    expect(readCursor(`200.${signature}`)).toBeNull();
  });

  it('rejects garbage and malformed tokens', () => {
    expect(readCursor('')).toBeNull();
    expect(readCursor('garbage')).toBeNull();
    expect(readCursor('40.')).toBeNull();
    expect(readCursor('.abc')).toBeNull();
  });

  it('rejects out-of-range limits even when correctly signed', () => {
    expect(readCursor(createCursor(0))).toBeNull();
    expect(readCursor(createCursor(201))).toBeNull();
  });
});
