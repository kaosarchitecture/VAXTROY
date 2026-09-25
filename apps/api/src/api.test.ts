import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { assertFileDatabase, openDatabase } from './db.ts';

const opened: { close: () => void }[] = [];

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaxtroy-'));
  return path.join(dir, 'vaxtroy.sqlite');
}

function boot(dbPath = tempDbPath()) {
  const db = openDatabase(dbPath);
  opened.push(db);
  return { db, app: createApp(db), dbPath };
}

afterEach(() => {
  while (opened.length > 0) {
    const db = opened.pop();
    try {
      db?.close();
    } catch {
      /* already closed */
    }
  }
});

describe('sqlite file', () => {
  it('refuses an in-memory database', () => {
    expect(() => assertFileDatabase(':memory:')).toThrow(/In-memory/);
    expect(() => openDatabase('file:vaxtroy?mode=memory')).toThrow(/In-memory/);
  });

  it('seeds a real file with 12 tables and 15 products', () => {
    const { db, dbPath } = boot();
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM venues) AS venues,
           (SELECT COUNT(*) FROM tables) AS tables,
           (SELECT COUNT(*) FROM products) AS products,
           (SELECT COUNT(*) FROM tickets) AS tickets,
           (SELECT COUNT(*) FROM ticket_lines) AS ticket_lines`,
      )
      .get() as Record<string, number>;
    expect({ ...counts }).toEqual({
      venues: 1,
      tables: 12,
      products: 15,
      tickets: 0,
      ticket_lines: 0,
    });
    expect(fs.statSync(dbPath).size).toBeGreaterThan(0);
    expect(fs.existsSync(dbPath)).toBe(true);
  });
});

describe('adisyon http', () => {
  it('opens a table, adds a line, totals, and closes with a payment method', async () => {
    const { app } = boot();
    const floor = await (await app.request('/api/floor')).json();
    expect(floor.tables).toHaveLength(12);
    expect(floor.venue.name).toBe('Vaxtroy');

    const productsResponse = await app.request('/api/products');
    const products = await productsResponse.json();
    const adana = products.products.find((item: { id: string }) => item.id === 'product_adana');
    expect(adana.priceKurus).toBe(32_000);

    const opened = await app.request('/api/tables/table_01/tickets', { method: 'POST' });
    expect(opened.status).toBe(201);
    const openedBody = await opened.json();
    const ticketId = openedBody.ticket.id as string;
    expect(openedBody.ticket.totalKurus).toBe(0);
    expect(openedBody.ticket.tableLabel).toBe('Masa 1');

    const duplicate = await app.request('/api/tables/table_01/tickets', { method: 'POST' });
    expect(duplicate.status).toBe(409);

    const added = await app.request(`/api/tickets/${ticketId}/lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'product_adana', quantity: 2 }),
    });
    expect(added.status).toBe(201);
    const addedBody = await added.json();
    expect(addedBody.ticket.lines).toHaveLength(1);
    expect(addedBody.ticket.lines[0].quantity).toBe(2);
    expect(addedBody.ticket.totalKurus).toBe(adana.priceKurus * 2);
    expect(addedBody.ticket.totalLabel).toBe('640,00 TL');

    const merged = await app.request(`/api/tickets/${ticketId}/lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'product_ayran', quantity: 1 }),
    });
    const mergedBody = await merged.json();
    expect(mergedBody.ticket.totalKurus).toBe(64_000 + 5_000);
    expect(mergedBody.ticket.lines).toHaveLength(2);

    const kitchen = await app.request(`/api/tickets/${ticketId}/kitchen`, { method: 'POST' });
    const kitchenBody = await kitchen.json();
    expect(kitchen.status).toBe(200);
    expect(kitchenBody.stub).toBe(true);
    expect(kitchenBody.implementation).toBe('STUB');
    expect(kitchenBody.ticket.kitchenSentAt).toEqual(expect.any(String));

    const invalid = await app.request(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'havale' }),
    });
    expect(invalid.status).toBe(400);

    const closed = await app.request(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'nakit' }),
    });
    const closedBody = await closed.json();
    expect(closed.status).toBe(200);
    expect(closedBody.stub).toBe(true);
    expect(closedBody.ticket.status).toBe('closed');
    expect(closedBody.ticket.paymentMethod).toBe('nakit');
    expect(closedBody.ticket.totalKurus).toBe(69_000);

    const lateLine = await app.request(`/api/tickets/${ticketId}/lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'product_cay', quantity: 1 }),
    });
    expect(lateLine.status).toBe(409);

    const floorAfter = await (await app.request('/api/floor')).json();
    const table = floorAfter.tables.find((item: { id: string }) => item.id === 'table_01');
    expect(table.status).toBe('empty');
    expect(table.openTicketId).toBeNull();
  });

  it('keeps the ticket after the database connection is closed and reopened', async () => {
    const dbPath = tempDbPath();
    const first = boot(dbPath);
    const opened = await first.app.request('/api/tables/table_03/tickets', { method: 'POST' });
    const ticketId = (await opened.json()).ticket.id as string;
    await first.app.request(`/api/tickets/${ticketId}/lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'product_kunefe', quantity: 1 }),
    });
    first.db.close();

    const second = boot(dbPath);
    const again = await second.app.request(`/api/tickets/${ticketId}`);
    const body = await again.json();
    expect(again.status).toBe(200);
    expect(body.ticket.status).toBe('open');
    expect(body.ticket.lines).toHaveLength(1);
    expect(body.ticket.lines[0].productName).toBe('Künefe');
    expect(body.ticket.totalKurus).toBe(18_000);
    expect(fs.statSync(dbPath).isFile()).toBe(true);

    const closed = await second.app.request(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'kart' }),
    });
    expect((await closed.json()).ticket.paymentMethod).toBe('kart');
    second.db.close();

    const third = boot(dbPath);
    const persisted = await (await third.app.request(`/api/tickets/${ticketId}`)).json();
    expect(persisted.ticket.status).toBe('closed');
    expect(persisted.ticket.paymentMethod).toBe('kart');
    expect(persisted.ticket.totalLabel).toBe('180,00 TL');
  });

  it('rejects an empty close and a missing table', async () => {
    const { app } = boot();
    const opened = await (await app.request('/api/tables/table_02/tickets', { method: 'POST' })).json();
    const emptyClose = await app.request(`/api/tickets/${opened.ticket.id}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'nakit' }),
    });
    expect(emptyClose.status).toBe(409);
    const missing = await app.request('/api/tables/table_99/tickets', { method: 'POST' });
    expect(missing.status).toBe(404);
  });
});
