// Post-score model. For a country + platform + instant:
//   activity   = country's internet-traffic rhythm at that local hour (0..1)
//   engagement = platform peak-window weight at that local hour/day (0..1)
//   raw        = geometric mean of the two — both must be high to score high
//   score      = raw scaled against that country+platform's best hour of the
//                week, so 10/10 always means "this country's best possible slot".
import trafficData from "@/data/traffic.json";
import countriesData from "@/data/countries.json";
import { localParts } from "./time";
import { platformById, type PlatformId } from "./platforms";

export interface CountryMeta {
  name: string;
  a2: string;
  n3: string;
  lat: number;
  lng: number;
  tz: string;
  multiTz: boolean;
}

export const COUNTRIES = countriesData as CountryMeta[];
export const countryByA2 = new Map(COUNTRIES.map((c) => [c.a2, c]));
export const countryByN3 = new Map(COUNTRIES.filter((c) => c.n3).map((c) => [c.n3, c]));

type Curves = { weekday: number[]; weekend: number[] };
const TRAFFIC = trafficData as { meta: { source: string; note?: string }; countries: Record<string, Curves> };

export const trafficSource = TRAFFIC.meta.source;

export function curvesFor(a2: string): Curves | undefined {
  return TRAFFIC.countries[a2];
}

function interp24(curve: number[], hourFloat: number): number {
  const i0 = Math.floor(hourFloat) % 24;
  const i1 = (i0 + 1) % 24;
  const frac = hourFloat - Math.floor(hourFloat);
  return curve[i0] * (1 - frac) + curve[i1] * frac;
}

export function activityAt(a2: string, hourFloat: number, isWeekend: boolean): number {
  const curves = curvesFor(a2);
  if (!curves) return 0;
  return interp24(isWeekend ? curves.weekend : curves.weekday, hourFloat);
}

export function engagementAt(platform: PlatformId, dow: number, hourFloat: number): number {
  return interp24(platformById(platform).weights[dow], hourFloat);
}

const rawScore = (activity: number, engagement: number) => Math.sqrt(activity * engagement);

// Best achievable raw score across a week, per country+platform (memoized).
const weekMaxCache = new Map<string, number>();
function weekMax(a2: string, platform: PlatformId): number {
  const key = `${a2}|${platform}`;
  let max = weekMaxCache.get(key);
  if (max === undefined) {
    max = 0.001;
    for (let d = 0; d < 7; d++) {
      const weekend = d === 0 || d === 6;
      for (let h = 0; h < 24; h += 0.5) {
        max = Math.max(max, rawScore(activityAt(a2, h, weekend), engagementAt(platform, d, h)));
      }
    }
    weekMaxCache.set(key, max);
  }
  return max;
}

export interface ScoreBreakdown {
  score: number; // 1..10
  activity: number; // 0..1
  engagement: number; // 0..1
}

export function scoreAt(a2: string, platform: PlatformId, date: Date): ScoreBreakdown {
  const meta = countryByA2.get(a2);
  if (!meta || !curvesFor(a2)) return { score: 1, activity: 0, engagement: 0 };
  const { hourFloat, dow, isWeekend } = localParts(meta.tz, date);
  const activity = activityAt(a2, hourFloat, isWeekend);
  const engagement = engagementAt(platform, dow, hourFloat);
  const score = Math.max(1, Math.min(10, Math.round((rawScore(activity, engagement) / weekMax(a2, platform)) * 10)));
  return { score, activity, engagement };
}

export const scoreLabel = (score: number): string =>
  score >= 9 ? "Prime time" : score >= 7 ? "Great time" : score >= 5 ? "Decent" : score >= 3 ? "Weak" : "Poor";

export interface BestWindow {
  start: Date;
  end: Date;
  peakScore: number;
}

// Contiguous runs of score ≥ threshold over the next 24h (30-min steps),
// highest-scoring three. Falls back to a lower bar if nothing clears 8.
export function bestWindows(a2: string, platform: PlatformId, from: Date): BestWindow[] {
  const steps: { t: number; score: number }[] = [];
  for (let m = 0; m <= 24 * 60; m += 30) {
    const t = from.getTime() + m * 60000;
    steps.push({ t, score: scoreAt(a2, platform, new Date(t)).score });
  }
  for (const threshold of [8, 7, 6]) {
    const runs: BestWindow[] = [];
    let cur: { start: number; end: number; peak: number } | null = null;
    for (const s of steps) {
      if (s.score >= threshold) {
        if (!cur) cur = { start: s.t, end: s.t, peak: s.score };
        cur.end = s.t;
        cur.peak = Math.max(cur.peak, s.score);
      } else if (cur) {
        runs.push({ start: new Date(cur.start), end: new Date(cur.end), peakScore: cur.peak });
        cur = null;
      }
    }
    if (cur) runs.push({ start: new Date(cur.start), end: new Date(cur.end), peakScore: cur.peak });
    const meaningful = runs.filter((r) => r.end.getTime() - r.start.getTime() >= 60 * 60000);
    if (meaningful.length) {
      return meaningful.sort((a, b) => b.peakScore - a.peakScore).slice(0, 3);
    }
  }
  return [];
}
