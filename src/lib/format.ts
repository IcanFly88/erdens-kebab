const MONTHS = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.',
];

export const DAY_NAMES = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

const pad = (n: number) => n.toString().padStart(2, '0');

/** 12345 → "12 345 Ft" (nem törhető szóközzel) */
export function formatPrice(value: number): string {
  const sign = value < 0 ? '−' : '';
  const digits = Math.abs(Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits} Ft`;
}

export function formatTime(ts: number | Date): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(ts: number | Date) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "ma", "holnap", "tegnap", vagy "okt. 28." */
export function formatDay(ts: number | Date, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return 'ma';
  if (diff === 1) return 'holnap';
  if (diff === -1) return 'tegnap';
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

export function formatDayTime(ts: number | Date, now: number = Date.now()): string {
  const day = formatDay(ts, now);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatTime(ts)}`;
}

export function formatRange([a, b]: [number, number]): string {
  return `${a}–${b} perc`;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
