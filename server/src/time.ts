import type { Location } from '../../src/data/locations.ts';

// A szerver akár UTC-ben is futhat, a nyitvatartás viszont budapesti idő szerint értendő.
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Budapest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function budapest(ts: number) {
  const p = Object.fromEntries(parts.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return {
    weekday: WEEKDAYS.indexOf(p.weekday),
    minutes: Number(p.hour) * 60 + Number(p.minute),
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Nyitva van-e az étterem `ts` időpontban, legalább `marginMinutes` perccel zárás előtt. */
export function isOpenAt(loc: Location, ts: number, marginMinutes = 0): boolean {
  const { weekday, minutes } = budapest(ts);
  const h = loc.hours[weekday];
  if (!h) return false;
  return minutes >= toMinutes(h.open) && minutes <= toMinutes(h.close) - marginMinutes;
}

export function formatTime(ts: number): string {
  return budapest(ts).time;
}
