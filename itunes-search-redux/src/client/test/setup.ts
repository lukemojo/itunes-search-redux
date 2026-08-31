import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// We run vitest without globals, so React's act() can't detect the test
// environment on its own — this flag tells it act() usage is intentional.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// We run vitest without globals, so testing-library can't register its own
// auto-cleanup afterEach — without this, rendered trees pile up across tests.
afterEach(() => {
  cleanup();
});
