import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLocation, LOCATIONS } from '../../src/data/locations.ts';
import { isFinal, nextStatuses, type OrderStatus } from '../../src/lib/order-status.ts';
import { broadcast, subscribe } from './events.ts';
import { buildOrder, nextSequence, ValidationError } from './orders.ts';
import { notifyCustomer } from './push.ts';
import { createStore, publicOrder, type StoredOrder } from './store.ts';
import { isOpenAt } from './time.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PANEL_DIR = join(ROOT, 'panel');
const PORT = Number(process.env.PORT ?? 4000);
const store = createStore(process.env.DB_PATH ?? join(ROOT, 'data', 'erdens.db'));

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Felhőben (Railway) a kérések proxyn keresztül jönnek; a valódi IP az X-Forwarded-For fejlécben van.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

// Éttermi panel PIN kódok környezeti változóból. Fejlesztéskor 1234; felhőben nincs alapértelmezett,
// ott a PIN beállításáig a panelbe nem lehet belépni (a rendelésfogadás ettől még működik).
const DEV_PIN = IS_PRODUCTION ? undefined : '1234';
const PINS: Record<string, string | undefined> = {
  monor: process.env.PANEL_PIN_MONOR ?? DEV_PIN,
};
if (!process.env.PANEL_PIN_MONOR) {
  console.warn(
    IS_PRODUCTION
      ? '[figyelem] PANEL_PIN_MONOR nincs beállítva – a panel belépés addig tiltva.'
      : '[figyelem] Fejlesztői panel PIN: 1234',
  );
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// --- segédfüggvények -------------------------------------------------------------------------

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'Túl nagy kérés');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Hibás JSON');
  }
}

/** Egyszerű, memóriában tartott korlát IP címenként (rendelés leadás, belépés). */
function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) throw new HttpError(429, 'Túl sok kérés, próbáld újra később');
    recent.push(now);
    hits.set(key, recent);
  };
}
const limitOrders = rateLimiter(30, 10 * 60_000);
const limitLogin = rateLimiter(10, 10 * 60_000);

function clientIp(req: IncomingMessage): string {
  const forwarded = TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function sameSecret(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function panelLocation(req: IncomingMessage, url: URL): string {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
  const locationId = token ? store.sessionLocation(token) : undefined;
  if (!locationId) throw new HttpError(401, 'Lejárt vagy hibás belépés');
  return locationId;
}

function changeOrder(order: StoredOrder, status: OrderStatus, patch: Partial<StoredOrder> = {}) {
  const now = Date.now();
  Object.assign(order, patch, { status, updatedAt: now });
  order.statusHistory.push({ status, at: now });
  store.saveOrder(order);
  broadcast(order.locationId, 'order', publicOrder(order));
  void notifyCustomer(order);
}

function locationStatus(now: number) {
  return LOCATIONS.map((l) => ({
    id: l.id,
    paused: store.isPaused(l.id),
    open: isOpenAt(l, now),
  }));
}

// --- útvonalak -------------------------------------------------------------------------------

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  // Vendég (mobil app)
  if (method === 'GET' && url.pathname === '/api/status') {
    return send(res, 200, { locations: locationStatus(Date.now()) });
  }

  if (method === 'POST' && url.pathname === '/api/orders') {
    limitOrders(clientIp(req));
    const body = await readJson(req);
    const now = Date.now();
    const locationId = (body as { locationId?: string }).locationId ?? '';
    const order = buildOrder(body, {
      now,
      paused: store.isPaused(locationId),
      sequence: nextSequence(store.ordersSince(locationId, now - 36 * 3600_000), now),
    });
    store.insertOrder(order);
    broadcast(order.locationId, 'order', publicOrder(order));
    console.log(`[rendelés] ${order.number} ${getLocation(order.locationId).city} ${order.total} Ft`);
    return send(res, 201, { order: publicOrder(order) });
  }

  if (parts[1] === 'orders' && parts[2]) {
    const order = store.getOrder(parts[2]);
    if (!order) throw new HttpError(404, 'A rendelés nem található');
    if (method === 'GET' && parts.length === 3) return send(res, 200, { order: publicOrder(order) });
    if (method === 'POST' && parts[3] === 'push-token') {
      const { token } = (await readJson(req)) as { token?: unknown };
      if (typeof token !== 'string' || token.length > 200) throw new HttpError(400, 'Hibás token');
      order.pushToken = token;
      store.saveOrder(order);
      return send(res, 200, { ok: true });
    }
  }

  // Éttermi panel
  if (method === 'POST' && url.pathname === '/api/panel/login') {
    limitLogin(clientIp(req));
    const { locationId, pin } = (await readJson(req)) as { locationId?: string; pin?: string };
    if (!locationId || !(locationId in PINS)) throw new HttpError(400, 'Ismeretlen étterem');
    const expected = PINS[locationId];
    if (!expected) throw new HttpError(503, 'A panel PIN kódja még nincs beállítva a szerveren.');
    if (typeof pin !== 'string' || !sameSecret(pin, expected)) {
      throw new HttpError(401, 'Hibás PIN kód');
    }
    return send(res, 200, { token: store.createSession(locationId!), locationId });
  }

  if (parts[1] !== 'panel') throw new HttpError(404, 'Nincs ilyen végpont');
  const locationId = panelLocation(req, url);

  if (method === 'GET' && url.pathname === '/api/panel/events') {
    return subscribe(locationId, res);
  }
  if (method === 'POST' && url.pathname === '/api/panel/logout') {
    const header = req.headers.authorization ?? '';
    store.deleteSession(header.slice(7));
    return send(res, 200, { ok: true });
  }
  if (method === 'GET' && url.pathname === '/api/panel/orders') {
    const now = Date.now();
    return send(res, 200, {
      location: getLocation(locationId),
      paused: store.isPaused(locationId),
      open: isOpenAt(getLocation(locationId), now),
      orders: store.panelOrders(locationId, now).map(publicOrder),
    });
  }
  if (method === 'POST' && url.pathname === '/api/panel/pause') {
    const { paused } = (await readJson(req)) as { paused?: unknown };
    store.setPaused(locationId, paused === true);
    broadcast(locationId, 'settings', { paused: paused === true });
    return send(res, 200, { paused: paused === true });
  }

  if (parts[2] === 'orders' && parts[3] && method === 'POST') {
    const order = store.getOrder(parts[3]);
    if (!order || order.locationId !== locationId) throw new HttpError(404, 'A rendelés nem található');
    const body = (await readJson(req)) as { minutes?: unknown; status?: unknown; reason?: unknown };
    const action = parts[4];

    if (action === 'accept') {
      if (order.status !== 'pending') throw new HttpError(409, 'A rendelést már feldolgozták');
      const minutes = body.minutes;
      if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 5 || minutes > 180) {
        throw new HttpError(400, 'Hibás elkészülési idő');
      }
      const readyAt = Date.now() + minutes * 60_000;
      // Előrendelésnél a vendég által kért időpont marad, ha az később van.
      if (order.scheduledFor && order.scheduledFor > readyAt) {
        changeOrder(order, 'accepted', { etaAt: order.scheduledFor });
      } else {
        order.statusHistory.push({ status: 'accepted', at: Date.now() });
        changeOrder(order, 'preparing', { etaAt: readyAt });
      }
      return send(res, 200, { order: publicOrder(order) });
    }

    if (action === 'status') {
      const status = body.status as OrderStatus;
      if (!nextStatuses(order.mode, order.status).includes(status)) {
        throw new HttpError(409, 'Ez a lépés most nem lehetséges');
      }
      changeOrder(order, status);
      return send(res, 200, { order: publicOrder(order) });
    }

    if (action === 'reject') {
      if (isFinal(order.status)) throw new HttpError(409, 'A rendelés már le van zárva');
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
      if (!reason) throw new HttpError(400, 'Add meg az elutasítás okát');
      changeOrder(order, 'rejected', { rejectReason: reason });
      return send(res, 200, { order: publicOrder(order) });
    }
  }

  throw new HttpError(404, 'Nincs ilyen végpont');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function servePanel(res: ServerResponse, pathname: string) {
  const rel = normalize(pathname.replace(/^\/panel\/?/, '') || 'index.html');
  if (rel.startsWith('..')) throw new HttpError(404, 'Nem található');
  try {
    const file = await readFile(join(PANEL_DIR, rel));
    res.writeHead(200, {
      'content-type': MIME[extname(rel)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(file);
  } catch {
    throw new HttpError(404, 'Nem található');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // A mobil app webes változata más originről hívhatja az API-t.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  try {
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    if (url.pathname === '/') return void res.writeHead(302, { location: '/panel/' }).end();
    if (url.pathname === '/panel') return void res.writeHead(302, { location: '/panel/' }).end();
    if (url.pathname.startsWith('/panel/')) return await servePanel(res, url.pathname);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    throw new HttpError(404, 'Nem található');
  } catch (err) {
    if (res.headersSent) return void res.end();
    if (err instanceof ValidationError) return send(res, 422, { error: err.message });
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Szerverhiba, próbáld újra' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Erdens Kebab szerver: http://localhost:${PORT}  ·  éttermi panel: /panel/`);
});

// Újratelepítéskor a tárhely SIGTERM-et küld: lezárjuk a kapcsolatokat és az adatbázist.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
