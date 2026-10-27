import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Order } from '../../src/lib/order-status.ts';

/** A tárolt rendelés a nyilvános adatokon túl a push tokent is tartalmazza. */
export type StoredOrder = Order & { pushToken?: string };

const DAY = 24 * 60 * 60_000;

export function createStore(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_by_location ON orders (location_id, created_at);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      location_id TEXT PRIMARY KEY,
      paused INTEGER NOT NULL DEFAULT 0,
      sold_out TEXT NOT NULL DEFAULT '[]'
    );
  `);
  // Korábbi adatbázisban még nincs elfogyott termék oszlop.
  const settingsColumns = db.prepare('PRAGMA table_info(settings)').all() as { name: string }[];
  if (!settingsColumns.some((c) => c.name === 'sold_out')) {
    db.exec(`ALTER TABLE settings ADD COLUMN sold_out TEXT NOT NULL DEFAULT '[]'`);
  }

  const parse = (row: unknown) => JSON.parse((row as { data: string }).data) as StoredOrder;

  const insert = db.prepare(
    'INSERT INTO orders (id, location_id, status, created_at, data) VALUES (?, ?, ?, ?, ?)',
  );
  const update = db.prepare('UPDATE orders SET status = ?, data = ? WHERE id = ?');
  const byId = db.prepare('SELECT data FROM orders WHERE id = ?');
  const recent = db.prepare(
    `SELECT data FROM orders
     WHERE location_id = ? AND (created_at > ? OR status NOT IN ('completed', 'rejected'))
     ORDER BY created_at DESC LIMIT 300`,
  );
  const sinceStmt = db.prepare('SELECT data FROM orders WHERE location_id = ? AND created_at > ?');

  return {
    insertOrder(order: StoredOrder) {
      insert.run(order.id, order.locationId, order.status, order.createdAt, JSON.stringify(order));
    },
    saveOrder(order: StoredOrder) {
      update.run(order.status, JSON.stringify(order), order.id);
    },
    getOrder(id: string): StoredOrder | undefined {
      const row = byId.get(id);
      return row ? parse(row) : undefined;
    },
    /** Az utolsó 24 óra rendelései és minden még le nem zárt rendelés. */
    panelOrders(locationId: string, now: number): StoredOrder[] {
      return recent.all(locationId, now - DAY).map(parse);
    },
    ordersSince(locationId: string, since: number): StoredOrder[] {
      return sinceStmt.all(locationId, since).map(parse);
    },

    createSession(locationId: string): string {
      const token = randomBytes(24).toString('hex');
      db.prepare('INSERT INTO sessions (token, location_id, created_at) VALUES (?, ?, ?)').run(
        token,
        locationId,
        Date.now(),
      );
      return token;
    },
    sessionLocation(token: string): string | undefined {
      const row = db
        .prepare('SELECT location_id FROM sessions WHERE token = ? AND created_at > ?')
        .get(token, Date.now() - 30 * DAY) as { location_id: string } | undefined;
      return row?.location_id;
    },
    deleteSession(token: string) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    },

    isPaused(locationId: string): boolean {
      const row = db.prepare('SELECT paused FROM settings WHERE location_id = ?').get(locationId) as
        | { paused: number }
        | undefined;
      return row?.paused === 1;
    },
    setPaused(locationId: string, paused: boolean) {
      db.prepare(
        `INSERT INTO settings (location_id, paused) VALUES (?, ?)
         ON CONFLICT(location_id) DO UPDATE SET paused = excluded.paused`,
      ).run(locationId, paused ? 1 : 0);
    },

    /** A panelen elfogyottnak jelölt termékek azonosítói. */
    soldOut(locationId: string): string[] {
      const row = db.prepare('SELECT sold_out FROM settings WHERE location_id = ?').get(locationId) as
        | { sold_out: string }
        | undefined;
      return row ? (JSON.parse(row.sold_out) as string[]) : [];
    },
    setSoldOut(locationId: string, itemIds: string[]) {
      db.prepare(
        `INSERT INTO settings (location_id, sold_out) VALUES (?, ?)
         ON CONFLICT(location_id) DO UPDATE SET sold_out = excluded.sold_out`,
      ).run(locationId, JSON.stringify(itemIds));
    },

    close() {
      db.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;

/** A vendégnek és a panelnek visszaadott nézet (push token nélkül). */
export function publicOrder({ pushToken: _, ...order }: StoredOrder): Order {
  return order;
}
