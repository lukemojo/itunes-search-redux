import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './src/mocks/node.js';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
