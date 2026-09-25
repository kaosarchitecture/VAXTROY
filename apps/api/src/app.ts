import { DomainError } from '@vaxtroy/domain';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  addLine,
  closeTicket,
  getTicket,
  getVenue,
  listProducts,
  listTables,
  openTicket,
  sendToKitchen,
  setLineQuantity,
} from './repo.ts';
import { toProductJson, toTableJson, toTicketJson } from './serialize.ts';

const addLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

const setQuantitySchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

const closeSchema = z.object({
  paymentMethod: z.enum(['nakit', 'kart']),
});

function jsonBody<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'Geçersiz istek',
          issues: result.error.issues.map((issue) => issue.message),
        },
        400,
      );
    }
  });
}

export function createApp(db: DatabaseSync): Hono {
  const app = new Hono();
  app.use('*', cors());

  app.get('/api/health', (c) => {
    const row = db.prepare('SELECT COUNT(*) AS venues FROM venues').get() as { venues: number };
    return c.json({ ok: true, storage: 'sqlite-file', venues: row.venues });
  });

  app.get('/api/floor', (c) => {
    const venue = getVenue(db);
    return c.json({
      venue: { id: venue.id, name: venue.name },
      tables: listTables(db).map(toTableJson),
    });
  });

  app.get('/api/products', (c) => {
    return c.json({ products: listProducts(db).map(toProductJson) });
  });

  app.get('/api/tickets/:ticketId', (c) => {
    const stored = getTicket(db, c.req.param('ticketId'));
    return c.json({ ticket: toTicketJson(stored.ticket, stored) });
  });

  app.post('/api/tables/:tableId/tickets', (c) => {
    const stored = openTicket(db, c.req.param('tableId'));
    return c.json({ ticket: toTicketJson(stored.ticket, stored) }, 201);
  });

  app.post('/api/tickets/:ticketId/lines', jsonBody(addLineSchema), (c) => {
    const body = c.req.valid('json');
    const stored = addLine(db, c.req.param('ticketId'), body.productId, body.quantity);
    return c.json({ ticket: toTicketJson(stored.ticket, stored) }, 201);
  });

  app.patch('/api/tickets/:ticketId/lines/:lineId', jsonBody(setQuantitySchema), (c) => {
    const body = c.req.valid('json');
    const stored = setLineQuantity(
      db,
      c.req.param('ticketId'),
      c.req.param('lineId'),
      body.quantity,
    );
    return c.json({ ticket: toTicketJson(stored.ticket, stored) });
  });

  app.post('/api/tickets/:ticketId/kitchen', (c) => {
    const stored = sendToKitchen(db, c.req.param('ticketId'));
    return c.json({
      stub: true,
      implementation: 'STUB',
      message: 'Mutfak kaydı tutuldu. Yazıcı veya KDS bağlı değil.',
      ticket: toTicketJson(stored.ticket, stored),
    });
  });

  app.post('/api/tickets/:ticketId/close', jsonBody(closeSchema), (c) => {
    const body = c.req.valid('json');
    const stored = closeTicket(db, c.req.param('ticketId'), body.paymentMethod);
    return c.json({
      stub: true,
      implementation: 'STUB',
      message: 'Ödeme yöntemi kaydedildi. Banka veya yazar kasa entegrasyonu yok.',
      ticket: toTicketJson(stored.ticket, stored),
    });
  });

  app.notFound((c) => c.json({ error: 'Bulunamadı' }, 404));

  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: 'Sunucu hatası' }, 500);
  });

  return app;
}
