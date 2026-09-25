import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DomainError,
  assertCanAddLine,
  assertCanClose,
  assertCanSendToKitchen,
  assertCanSetQuantity,
  mergedQuantity,
  money,
  tableStatus,
  type DiningTable,
  type PaymentMethod,
  type Product,
  type Ticket,
  type TicketLine,
  type TicketStatus,
} from '@vaxtroy/domain';
import { checkpoint } from './db.ts';

type VenueRow = { id: string; name: string };
type TableRow = { id: string; label: string; seats: number; open_ticket_id: string | null };
type ProductRow = {
  id: string;
  name: string;
  category: string;
  price_kurus: number;
  active: number;
};
type TicketRow = {
  id: string;
  table_id: string;
  table_label: string;
  status: TicketStatus;
  payment_method: PaymentMethod | null;
  kitchen_sent_at: string | null;
  opened_at: string;
  closed_at: string | null;
};
type LineRow = {
  id: string;
  product_id: string;
  product_name: string;
  unit_price_kurus: number;
  quantity: number;
};

export type StoredTicket = {
  ticket: Ticket;
  tableLabel: string;
  openedAt: string;
  closedAt: string | null;
};

function persist<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    checkpoint(db);
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* no active transaction */
    }
    if (error instanceof Error && error.message.includes('idx_one_open_ticket_per_table')) {
      throw new DomainError('Bu masada zaten açık adisyon var');
    }
    throw error;
  }
}

export function getVenue(db: DatabaseSync): VenueRow {
  const venue = db.prepare('SELECT id, name FROM venues ORDER BY created_at ASC LIMIT 1').get() as
    | VenueRow
    | undefined;
  if (!venue) throw new DomainError('Salon bulunamadı', 404);
  return venue;
}

export function listTables(db: DatabaseSync): DiningTable[] {
  const venue = getVenue(db);
  const rows = db
    .prepare(
      `SELECT t.id, t.label, t.seats, tk.id AS open_ticket_id
       FROM tables t
       LEFT JOIN tickets tk ON tk.table_id = t.id AND tk.status = 'open'
       WHERE t.venue_id = ?
       ORDER BY t.sort_order ASC`,
    )
    .all(venue.id) as TableRow[];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    seats: row.seats,
    status: tableStatus(row.open_ticket_id),
    openTicketId: row.open_ticket_id,
  }));
}

export function listProducts(db: DatabaseSync): Product[] {
  const venue = getVenue(db);
  const rows = db
    .prepare(
      `SELECT id, name, category, price_kurus, active
       FROM products
       WHERE venue_id = ? AND active = 1
       ORDER BY sort_order ASC`,
    )
    .all(venue.id) as ProductRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: money(row.price_kurus),
    active: row.active === 1,
  }));
}

function readLines(db: DatabaseSync, ticketId: string): TicketLine[] {
  const rows = db
    .prepare(
      `SELECT id, product_id, product_name, unit_price_kurus, quantity
       FROM ticket_lines
       WHERE ticket_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(ticketId) as LineRow[];
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: money(row.unit_price_kurus),
    quantity: row.quantity,
  }));
}

export function getTicket(db: DatabaseSync, ticketId: string): StoredTicket {
  const row = db
    .prepare(
      `SELECT t.id, t.table_id, tb.label AS table_label, t.status, t.payment_method,
              t.kitchen_sent_at, t.opened_at, t.closed_at
       FROM tickets t
       JOIN tables tb ON tb.id = t.table_id
       WHERE t.id = ?`,
    )
    .get(ticketId) as TicketRow | undefined;
  if (!row) throw new DomainError('Adisyon bulunamadı', 404);
  return {
    ticket: {
      id: row.id,
      tableId: row.table_id,
      status: row.status,
      lines: readLines(db, row.id),
      paymentMethod: row.payment_method,
      kitchenSentAt: row.kitchen_sent_at,
    },
    tableLabel: row.table_label,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

export function openTicket(db: DatabaseSync, tableId: string): StoredTicket {
  return persist(db, () => {
    const venue = getVenue(db);
    const table = db
      .prepare('SELECT id FROM tables WHERE id = ? AND venue_id = ?')
      .get(tableId, venue.id) as { id: string } | undefined;
    if (!table) throw new DomainError('Masa bulunamadı', 404);
    const existing = db
      .prepare(`SELECT id FROM tickets WHERE table_id = ? AND status = 'open'`)
      .get(tableId) as { id: string } | undefined;
    if (existing) throw new DomainError('Bu masada zaten açık adisyon var');
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tickets (id, venue_id, table_id, status, payment_method, opened_at, closed_at, kitchen_sent_at)
       VALUES (?, ?, ?, 'open', NULL, ?, NULL, NULL)`,
    ).run(id, venue.id, tableId, now);
    return getTicket(db, id);
  });
}

export function addLine(
  db: DatabaseSync,
  ticketId: string,
  productId: string,
  quantity: number,
): StoredTicket {
  return persist(db, () => {
    const current = getTicket(db, ticketId);
    assertCanAddLine(current.ticket.status, quantity);
    const venue = getVenue(db);
    const product = db
      .prepare(
        `SELECT id, name, price_kurus, active
         FROM products WHERE id = ? AND venue_id = ?`,
      )
      .get(productId, venue.id) as
      | { id: string; name: string; price_kurus: number; active: number }
      | undefined;
    if (!product || product.active !== 1) throw new DomainError('Ürün bulunamadı', 404);
    const existing = db
      .prepare(`SELECT id, quantity FROM ticket_lines WHERE ticket_id = ? AND product_id = ?`)
      .get(ticketId, productId) as { id: string; quantity: number } | undefined;
    if (existing) {
      const next = mergedQuantity(existing.quantity, quantity);
      db.prepare('UPDATE ticket_lines SET quantity = ? WHERE id = ?').run(next, existing.id);
    } else {
      db.prepare(
        `INSERT INTO ticket_lines
         (id, ticket_id, product_id, product_name, unit_price_kurus, quantity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        ticketId,
        product.id,
        product.name,
        product.price_kurus,
        quantity,
        new Date().toISOString(),
      );
    }
    return getTicket(db, ticketId);
  });
}

export function setLineQuantity(
  db: DatabaseSync,
  ticketId: string,
  lineId: string,
  quantity: number,
): StoredTicket {
  return persist(db, () => {
    const current = getTicket(db, ticketId);
    assertCanSetQuantity(current.ticket.status, quantity);
    const line = db
      .prepare('SELECT id FROM ticket_lines WHERE id = ? AND ticket_id = ?')
      .get(lineId, ticketId) as { id: string } | undefined;
    if (!line) throw new DomainError('Satır bulunamadı', 404);
    if (quantity === 0) {
      db.prepare('DELETE FROM ticket_lines WHERE id = ?').run(lineId);
    } else {
      db.prepare('UPDATE ticket_lines SET quantity = ? WHERE id = ?').run(quantity, lineId);
    }
    return getTicket(db, ticketId);
  });
}

export function sendToKitchen(db: DatabaseSync, ticketId: string): StoredTicket {
  return persist(db, () => {
    const current = getTicket(db, ticketId);
    assertCanSendToKitchen(current.ticket.status, current.ticket.lines.length);
    db.prepare(`UPDATE tickets SET kitchen_sent_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      ticketId,
    );
    return getTicket(db, ticketId);
  });
}

export function closeTicket(
  db: DatabaseSync,
  ticketId: string,
  paymentMethod: string,
): StoredTicket {
  return persist(db, () => {
    const current = getTicket(db, ticketId);
    assertCanClose(current.ticket.status, current.ticket.lines.length, paymentMethod);
    db.prepare(
      `UPDATE tickets
       SET status = 'closed', payment_method = ?, closed_at = ?
       WHERE id = ?`,
    ).run(paymentMethod, new Date().toISOString(), ticketId);
    return getTicket(db, ticketId);
  });
}
