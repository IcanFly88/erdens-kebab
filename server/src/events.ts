import type { ServerResponse } from 'node:http';

// Server-Sent Events: az éttermi panel így kapja meg azonnal az új és frissült rendeléseket.
const clients = new Map<string, Set<ServerResponse>>();

export function subscribe(locationId: string, res: ServerResponse) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  let set = clients.get(locationId);
  if (!set) clients.set(locationId, (set = new Set()));
  set.add(res);
  res.on('close', () => set.delete(res));
}

export function broadcast(locationId: string, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.get(locationId) ?? []) res.write(payload);
}

// Életjel, hogy a proxyk ne bontsák a tétlen kapcsolatot.
setInterval(() => {
  for (const set of clients.values()) for (const res of set) res.write(': ping\n\n');
}, 20_000).unref();
