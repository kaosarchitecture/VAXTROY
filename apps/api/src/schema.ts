export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_init',
    sql: `
      CREATE TABLE venues (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE tables (
        id TEXT PRIMARY KEY,
        venue_id TEXT NOT NULL REFERENCES venues(id),
        label TEXT NOT NULL,
        seats INTEGER NOT NULL CHECK (seats > 0),
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        venue_id TEXT NOT NULL REFERENCES venues(id),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price_kurus INTEGER NOT NULL CHECK (price_kurus >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE tickets (
        id TEXT PRIMARY KEY,
        venue_id TEXT NOT NULL REFERENCES venues(id),
        table_id TEXT NOT NULL REFERENCES tables(id),
        status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
        payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('nakit', 'kart')),
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        kitchen_sent_at TEXT
      );

      CREATE TABLE ticket_lines (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        unit_price_kurus INTEGER NOT NULL CHECK (unit_price_kurus >= 0),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_tickets_table_status ON tickets(table_id, status);
      CREATE INDEX idx_ticket_lines_ticket ON ticket_lines(ticket_id);
      CREATE UNIQUE INDEX idx_one_open_ticket_per_table
        ON tickets(table_id) WHERE status = 'open';
    `,
  },
];
