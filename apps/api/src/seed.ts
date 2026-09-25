import type { DatabaseSync } from 'node:sqlite';

const VENUE_ID = 'venue_vaxtroy';

const PRODUCTS: { id: string; name: string; category: string; priceKurus: number }[] = [
  { id: 'product_mercimek', name: 'Mercimek Çorbası', category: 'Çorba', priceKurus: 9_000 },
  { id: 'product_ezogelin', name: 'Ezogelin Çorbası', category: 'Çorba', priceKurus: 9_500 },
  { id: 'product_adana', name: 'Adana Kebap', category: 'Ana Yemek', priceKurus: 32_000 },
  { id: 'product_urfa', name: 'Urfa Kebap', category: 'Ana Yemek', priceKurus: 32_000 },
  { id: 'product_tavuk_sis', name: 'Tavuk Şiş', category: 'Ana Yemek', priceKurus: 28_000 },
  { id: 'product_kofte', name: 'Izgara Köfte', category: 'Ana Yemek', priceKurus: 26_000 },
  { id: 'product_karisik', name: 'Karışık Izgara', category: 'Ana Yemek', priceKurus: 45_000 },
  { id: 'product_kiymali_pide', name: 'Kıymalı Pide', category: 'Pide', priceKurus: 22_000 },
  { id: 'product_kasarli_pide', name: 'Kaşarlı Pide', category: 'Pide', priceKurus: 20_000 },
  { id: 'product_coban', name: 'Çoban Salata', category: 'Salata', priceKurus: 12_000 },
  { id: 'product_ayran', name: 'Ayran', category: 'İçecek', priceKurus: 5_000 },
  { id: 'product_kola', name: 'Kola', category: 'İçecek', priceKurus: 6_000 },
  { id: 'product_cay', name: 'Çay', category: 'İçecek', priceKurus: 2_500 },
  { id: 'product_kahve', name: 'Türk Kahvesi', category: 'İçecek', priceKurus: 7_000 },
  { id: 'product_kunefe', name: 'Künefe', category: 'Tatlı', priceKurus: 18_000 },
];

function countOf(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
  return row.c;
}

/** Inserts the demo venue, 12 tables, and 15 menu rows when the file is empty. */
export function seedIfEmpty(db: DatabaseSync): void {
  if (countOf(db, 'venues') > 0) return;

  const now = new Date().toISOString();
  const insertTable = db.prepare(
    `INSERT INTO tables (id, venue_id, label, seats, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (id, venue_id, name, category, price_kurus, active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO venues (id, name, created_at) VALUES (?, ?, ?)').run(
      VENUE_ID,
      'Vaxtroy',
      now,
    );
    for (let number = 1; number <= 12; number += 1) {
      const seats = number >= 11 ? 6 : number >= 9 ? 2 : 4;
      insertTable.run(
        `table_${String(number).padStart(2, '0')}`,
        VENUE_ID,
        `Masa ${number}`,
        seats,
        number,
        now,
      );
    }
    PRODUCTS.forEach((product, index) => {
      insertProduct.run(
        product.id,
        VENUE_ID,
        product.name,
        product.category,
        product.priceKurus,
        index + 1,
        now,
      );
    });
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
