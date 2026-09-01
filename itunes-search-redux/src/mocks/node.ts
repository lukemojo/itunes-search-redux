import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

/** MSW server for node-env tests*/
export const mswServer = setupServer(...handlers);
