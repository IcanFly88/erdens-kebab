import type { Location } from '@/data/locations';
import { DAY_NAMES, formatDay, formatTime } from '@/lib/format';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function at(base: Date, hhmm: string, dayOffset = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  const mins = toMinutes(hhmm);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function isOpenAt(loc: Location, date: Date): boolean {
  const h = loc.hours[date.getDay()];
  if (!h) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  return m >= toMinutes(h.open) && m < toMinutes(h.close);
}

export function closingTime(loc: Location, date: Date): Date | null {
  const h = loc.hours[date.getDay()];
  return h ? at(date, h.close) : null;
}

export function nextOpening(loc: Location, from: Date): Date | null {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + offset);
    const h = loc.hours[day.getDay()];
    if (!h) continue;
    const open = at(from, h.open, offset);
    if (open > from) return open;
  }
  return null;
}

export type OpenStatus = { open: boolean; label: string; detail: string };

export function openStatus(loc: Location, now: Date): OpenStatus {
  if (isOpenAt(loc, now)) {
    const close = closingTime(loc, now)!;
    return { open: true, label: 'Nyitva', detail: `${formatTime(close)}-ig` };
  }
  const next = nextOpening(loc, now);
  if (!next) return { open: false, label: 'Zárva', detail: '' };
  const offsetDays = Math.round(
    (new Date(next).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  const day = offsetDays <= 1 ? formatDay(next, now.getTime()) : DAY_NAMES[next.getDay()];
  return { open: false, label: 'Zárva', detail: `Nyit: ${day} ${formatTime(next)}` };
}

export function hoursLabel(loc: Location, dayIndex: number): string {
  const h = loc.hours[dayIndex];
  return h ? `${h.open}–${h.close}` : 'Zárva';
}

/**
 * Ütemezhető időpontok 15 percenként a következő két nyitvatartási napra.
 * Az első időpont legalább `leadMinutes` perccel a jelenlegi idő utánra esik.
 */
export function scheduleSlots(loc: Location, now: Date, leadMinutes: number): Date[] {
  const slots: Date[] = [];
  const earliest = now.getTime() + leadMinutes * 60_000;
  let openDays = 0;
  for (let offset = 0; offset < 8 && openDays < 2; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const h = loc.hours[day.getDay()];
    if (!h) continue;
    const open = at(now, h.open, offset).getTime() + 30 * 60_000;
    const close = at(now, h.close, offset).getTime();
    let t = Math.max(open, earliest);
    t = Math.ceil(t / (15 * 60_000)) * 15 * 60_000;
    let added = 0;
    for (; t <= close; t += 15 * 60_000, added++) slots.push(new Date(t));
    if (added > 0) openDays++;
  }
  return slots;
}
