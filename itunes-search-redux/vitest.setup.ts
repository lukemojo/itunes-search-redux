import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './src/mocks/node.js';

beforeAll(() =>
  mswServer.listen({
    // Fail loudly on any unmocked external request, but let loopback traffic
    // through — supertest drives the Express app over real localhost sockets.
    onUnhandledRequest: (request, print) => {
      const { hostname } = new URL(request.url);
      if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1') return;
      print.error();
    },
  }),
);
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
