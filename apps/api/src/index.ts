import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

function resolveDbPath(): string {
  const fromEnv = process.env.VAXTROY_DB_PATH;
  if (!fromEnv) return path.join(repoRoot, 'data', 'vaxtroy.sqlite');
  return path.isAbsolute(fromEnv) ? fromEnv : path.join(repoRoot, fromEnv);
}

const port = Number(process.env.PORT ?? '3001');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT ?? ''}`);
}

const dbPath = resolveDbPath();
const db = openDatabase(dbPath);
const app = createApp(db);

const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Vaxtroy API http://127.0.0.1:${info.port}`);
  console.log(`SQLite file ${dbPath}`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Drop idle keep-alive sockets so the process can exit after SIGTERM.
  if ('closeAllConnections' in server) {
    server.closeAllConnections();
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
