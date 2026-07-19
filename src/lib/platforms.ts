// Per-platform engagement weights: a 7×24 matrix (day-of-week × local hour,
// 0..1) encoding the peak windows from the 2026 Sprout Social (~2B engagements)
// and Buffer (52M posts) studies. These are population-level heuristics in the
// audience's LOCAL time — the score combines them with the country's own
// traffic rhythm.

export type PlatformId = "facebook" | "instagram" | "tiktok" | "x" | "linkedin" | "youtube";

interface Win {
  days: number[]; // 0=Sun .. 6=Sat
  from: number; // inclusive hour
  to: number; // exclusive hour
  w: number;
}

const WD = [1, 2, 3, 4, 5]; // Mon-Fri
const MID = [2, 3, 4]; // Tue-Thu

function buildMatrix(windows: Win[]): number[][] {
  const m = Array.from({ length: 7 }, () => new Array(24).fill(0.25));
  // overnight hours are a poor bet on every platform
  for (let d = 0; d < 7; d++) for (let h = 0; h < 6; h++) m[d][h] = 0.1;
  for (const win of windows) {
    for (const d of win.days) {
      for (let h = win.from; h < win.to; h++) m[d][h] = Math.max(m[d][h], win.w);
    }
  }
  // soften edges so windows ramp in/out instead of stepping
  return m.map((day) =>
    day.map((v, h) => {
      const prev = day[(h + 23) % 24];
      const next = day[(h + 1) % 24];
      return +(0.2 * prev + 0.6 * v + 0.2 * next).toFixed(3);
    })
  );
}

export interface Platform {
  id: PlatformId;
  label: string;
  weights: number[][];
  bestKnown: string; // one-line summary shown in the UI
}

export const PLATFORMS: Platform[] = [
  {
    id: "facebook",
    label: "Facebook",
    bestKnown: "Weekdays 9am–3pm, strongest Tue–Thu mornings",
    weights: buildMatrix([
      { days: WD, from: 9, to: 17, w: 0.85 },
      { days: MID, from: 9, to: 14, w: 1.0 },
      { days: WD, from: 18, to: 21, w: 0.5 },
      { days: [0, 6], from: 9, to: 13, w: 0.55 },
    ]),
  },
  {
    id: "instagram",
    label: "Instagram",
    bestKnown: "Midday–evening, peaks Tue 1–7pm and Wed noon–9pm",
    weights: buildMatrix([
      { days: WD, from: 11, to: 18, w: 0.8 },
      { days: [1], from: 14, to: 16, w: 1.0 },
      { days: [2], from: 13, to: 19, w: 1.0 },
      { days: [3], from: 12, to: 21, w: 1.0 },
      { days: [4], from: 12, to: 14, w: 1.0 },
      { days: [6], from: 9, to: 13, w: 0.6 },
    ]),
  },
  {
    id: "tiktok",
    label: "TikTok",
    bestKnown: "Tue–Thu 2–6pm; Sunday mornings also strong",
    weights: buildMatrix([
      { days: WD, from: 12, to: 19, w: 0.8 },
      { days: MID, from: 14, to: 18, w: 1.0 },
      { days: [5], from: 17, to: 21, w: 0.9 },
      { days: [0], from: 9, to: 11, w: 0.85 },
      { days: [6], from: 10, to: 14, w: 0.7 },
      { days: WD, from: 19, to: 22, w: 0.65 },
    ]),
  },
  {
    id: "x",
    label: "X / Twitter",
    bestKnown: "Weekday mornings 8–11am",
    weights: buildMatrix([
      { days: WD, from: 8, to: 11, w: 1.0 },
      { days: WD, from: 11, to: 15, w: 0.85 },
      { days: [6], from: 9, to: 12, w: 0.5 },
    ]),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    bestKnown: "Tue–Thu 8–10am before meetings; dead on weekends",
    weights: buildMatrix([
      { days: MID, from: 8, to: 10, w: 1.0 },
      { days: MID, from: 10, to: 17, w: 0.9 },
      { days: [1, 5], from: 9, to: 15, w: 0.7 },
    ]).map((day, d) => (d === 0 || d === 6 ? day.map((v) => Math.min(v, 0.15)) : day)),
  },
  {
    id: "youtube",
    label: "YouTube",
    bestKnown: "Weekday afternoons 2–6pm; weekend mornings",
    weights: buildMatrix([
      { days: WD, from: 14, to: 18, w: 0.9 },
      { days: [5], from: 15, to: 20, w: 1.0 },
      { days: [0, 6], from: 9, to: 12, w: 0.95 },
      { days: WD, from: 19, to: 21, w: 0.7 },
    ]),
  },
];

export const platformById = (id: PlatformId): Platform =>
  PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
