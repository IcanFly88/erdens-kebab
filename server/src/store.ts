import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Order } from '../../src/lib/order-status.ts';

/** A tárolt rendelés a nyilvános adatokon túl a push tokent is tartalmazza. */
export type StoredOrder = Order & { pushToken?: string };

const DAY = 24 * 60 * 60_000;

type Arg = string | number | null;
type Row = Record<string, unknown>;

/** Egy SQL utasítás végrehajtása; SELECT/PRAGMA esetén a sorokat adja vissza. */
type Driver = {
  kind: 'turso' | 'local';
  execute(sql: string, args?: Arg[]): Promise<Row[]>;
  close(): void;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders (
     id TEXT PRIMARY KEY,
     location_id TEXT NOT NULL,
     status TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     data TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS orders_by_location ON orders (location_id, created_at)',
  `CREATE TABLE IF NOT EXISTS sessions (
     token TEXT PRIMARY KEY,
     location_id TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     location_id TEXT PRIMARY KEY,
     paused INTEGER NOT NULL DEFAULT 0,
     sold_out TEXT NOT NULL DEFAULT '[]'
   )`,
];

/** Helyi SQLite fájl – fejlesztéshez, illetve ha nincs beállítva felhős adatbázis. */
function localDriver(path: string): Driver {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  return {
    kind: 'local',
    async execute(sql, args = []) {
      const stmt = db.prepare(sql);
      if (/^\s*(select|pragma)/i.test(sql)) return stmt.all(...args) as Row[];
      stmt.run(...args);
      return [];
    },
    close: () => db.close(),
  };
}

/**
 * Turso (felhős SQLite) a HTTP API-n keresztül, külső csomag nélkül.
 * Így az ingyenes tárhely újraindításakor és újratelepítésekor sem vesznek el a rendelések.
 * https://docs.turso.tech/sdk/http/reference
 */
function tursoDriver(url: string, token: string): Driver {
  const endpoint = `${url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '')}/v2/pipeline`;
  const encode = (v: Arg) =>
    v === null
      ? { type: 'null' }
      : typeof v === 'number'
        ? Number.isInteger(v)
          ? { type: 'integer', value: String(v) }
          : { type: 'float', value: v }
        : { type: 'text', value: v };
  const decode = (v: { type: string; value?: string | number; base64?: string }) =>
    v.type === 'null' ? null : v.type === 'integer' ? Number(v.value) : v.value;

  async function post(body: string) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<{
      results: (
        | { type: 'ok'; response: { result: { cols: { name: string }[]; rows: Parameters<typeof decode>[0][][] } } }
        | { type: 'error'; error: { message: string } }
      )[];
    }>;
  }

  return {
    kind: 'turso',
    async execute(sql, args = []) {
      const body = JSON.stringify({
        requests: [{ type: 'execute', stmt: { sql, args: args.map(encode) } }, { type: 'close' }],
      });
      // Hálózati hiba vagy 5xx esetén egyszer újrapróbáljuk (SQL hibánál nem).
      let data;
      try {
        data = await post(body);
      } catch (err) {
        if (err instanceof Error && /HTTP 4\d\d/.test(err.message)) throw err;
        await new Promise((resolve) => setTimeout(resolve, 400));
        data = await post(body);
      }
      const result = data.results[0];
      if (result.type === 'error') throw new Error(`Turso: ${result.error.message}`);
      const { cols, rows } = result.response.result;
      return rows.map((row) => Object.fromEntries(cols.map((c, i) => [c.name, decode(row[i])])));
    },
    close: () => {},
  };
}

export async function openStore(opts: { path: string; tursoUrl?: string; tursoToken?: string }) {
  const driver =
    opts.tursoUrl && opts.tursoToken
      ? tursoDriver(opts.tursoUrl, opts.tursoToken)
      : localDriver(opts.path);
  const run = driver.execute;

  for (const sql of SCHEMA) await run(sql);
  // Korábbi adatbázisban még nincs elfogyott termék oszlop.
  const settingsColumns = await run('PRAGMA table_info(settings)');
  if (!settingsColumns.some((c) => c.name === 'sold_out')) {
    await run(`ALTER TABLE settings ADD COLUMN sold_out TEXT NOT NULL DEFAULT '[]'`);
  }

  const parse = (rows: Row[]) => rows.map((r) => JSON.parse(String(r.data)) as StoredOrder);
  const settingsRow = async (locationId: string) =>
    (await run('SELECT paused, sold_out FROM settings WHERE location_id = ?', [locationId]))[0];

  return {
    kind: driver.kind,

    async insertOrder(order: StoredOrder) {
      await run(
        'INSERT INTO orders (id, location_id, status, created_at, data) VALUES (?, ?, ?, ?, ?)',
        [order.id, order.locationId, order.status, order.createdAt, JSON.stringify(order)],
      );
    },
    async saveOrder(order: StoredOrder) {
      await run('UPDATE orders SET status = ?, data = ? WHERE id = ?', [
        order.status,
        JSON.stringify(order),
        order.id,
      ]);
    },
    async getOrder(id: string): Promise<StoredOrder | undefined> {
      return parse(await run('SELECT data FROM orders WHERE id = ?', [id]))[0];
    },
    /** Az utolsó 24 óra rendelései és minden még le nem zárt rendelés. */
    async panelOrders(locationId: string, now: number): Promise<StoredOrder[]> {
      return parse(
        await run(
          `SELECT data FROM orders
           WHERE location_id = ? AND (created_at > ? OR status NOT IN ('completed', 'rejected'))
           ORDER BY created_at DESC LIMIT 300`,
          [locationId, now - DAY],
        ),
      );
    },
    async ordersSince(locationId: string, since: number): Promise<StoredOrder[]> {
      return parse(
        await run('SELECT data FROM orders WHERE location_id = ? AND created_at > ?', [
          locationId,
          since,
        ]),
      );
    },

    async createSession(locationId: string): Promise<string> {
      const token = randomBytes(24).toString('hex');
      await run('INSERT INTO sessions (token, location_id, created_at) VALUES (?, ?, ?)', [
        token,
        locationId,
        Date.now(),
      ]);
      return token;
    },
    async sessionLocation(token: string): Promise<string | undefined> {
      const rows = await run(
        'SELECT location_id FROM sessions WHERE token = ? AND created_at > ?',
        [token, Date.now() - 30 * DAY],
      );
      return rows[0]?.location_id as string | undefined;
    },
    async deleteSession(token: string) {
      await run('DELETE FROM sessions WHERE token = ?', [token]);
    },

    /** Szüneteltetés és a panelen elfogyottnak jelölt termékek azonosítói. */
    async settings(locationId: string): Promise<{ paused: boolean; soldOut: string[] }> {
      const row = await settingsRow(locationId);
      return {
        paused: row?.paused === 1,
        soldOut: row ? (JSON.parse(String(row.sold_out)) as string[]) : [],
      };
    },
    async setPaused(locationId: string, paused: boolean) {
      await run(
        `INSERT INTO settings (location_id, paused) VALUES (?, ?)
         ON CONFLICT(location_id) DO UPDATE SET paused = excluded.paused`,
        [locationId, paused ? 1 : 0],
      );
    },
    async setSoldOut(locationId: string, itemIds: string[]) {
      await run(
        `INSERT INTO settings (location_id, sold_out) VALUES (?, ?)
         ON CONFLICT(location_id) DO UPDATE SET sold_out = excluded.sold_out`,
        [locationId, JSON.stringify(itemIds)],
      );
    },

    close: driver.close,
  };
}

export type Store = Awaited<ReturnType<typeof openStore>>;

/** A vendégnek és a panelnek visszaadott nézet (push token nélkül). */
export function publicOrder({ pushToken: _, ...order }: StoredOrder): Order {
  return order;
}
