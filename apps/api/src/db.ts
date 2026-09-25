import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './schema.ts';
import { seedIfEmpty } from './seed.ts';

export function assertFileDatabase(dbPath: string): string {
  const trimmed = dbPath.trim();
  if (trimmed === '' || trimmed === ':memory:' || /mode=memory/i.test(trimmed)) {
    throw new Error('In-memory SQLite is not allowed. VAXTROY_DB_PATH must be a file path.');
  }
  return path.resolve(trimmed);
}

export function openDatabase(dbPath: string): DatabaseSync {
  const absolute = assertFileDatabase(dbPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const db = new DatabaseSync(absolute);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  seedIfEmpty(db);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
      (row) => row.name,
    ),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* no active transaction */
      }
      throw error;
    }
  }
}

export function checkpoint(db: DatabaseSync): void {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}
