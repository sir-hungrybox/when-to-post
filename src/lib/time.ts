// Timezone math without a date library. Offsets are cached per (zone, 6h
// bucket) so the per-frame world sweep is pure arithmetic — Intl only runs
// on cache misses (offsets only change at DST boundaries).

const offsetCache = new Map<string, number>();

function computeTzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = +part.value;
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000) * 60000;
}

export function tzOffsetMs(tz: string, date: Date): number {
  const bucket = Math.floor(date.getTime() / (6 * 3600e3));
  const key = `${tz}|${bucket}`;
  let off = offsetCache.get(key);
  if (off === undefined) {
    off = computeTzOffsetMs(tz, date);
    offsetCache.set(key, off);
  }
  return off;
}

export interface LocalParts {
  hourFloat: number; // 0..24
  dow: number; // 0=Sun .. 6=Sat
  isWeekend: boolean;
}

export function localParts(tz: string, date: Date): LocalParts {
  const shifted = new Date(date.getTime() + tzOffsetMs(tz, date));
  const hourFloat = shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
  const dow = shifted.getUTCDay();
  return { hourFloat, dow, isWeekend: dow === 0 || dow === 6 };
}

export function formatInTz(tz: string, date: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", minute: "2-digit", ...opts,
  }).format(date);
}

export const viewerTz = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
