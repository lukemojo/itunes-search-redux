import { createApp } from './app.js';

// Render injects PORT in production — never hardcode it
const port = Number(process.env.PORT ?? 3001);

const server = createApp().listen(port, () => {
  console.log(`iTunes search server listening on http://localhost:${port}`);
});

// Render sends SIGTERM on every deploy/restart: stop accepting connections,
// let in-flight requests finish, then exit.
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
