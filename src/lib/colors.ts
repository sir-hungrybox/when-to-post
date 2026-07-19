// Validated amber sequential ramp (dark surface #0d0d0d) — activity/score
// magnitude everywhere: globe choropleth, score dial, chart fill.
// Engagement overlay uses categorical blue so the two measures never share a hue.
export const AMBER_RAMP = ["#5f4407", "#7d5908", "#9c6f0a", "#bb860c", "#d89c0d", "#f4b41f", "#ffd166"];
export const SERIES_BLUE = "#3987e5";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** t in 0..1 → interpolated ramp color */
export function rampColor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (AMBER_RAMP.length - 1);
  const i = Math.min(Math.floor(x), AMBER_RAMP.length - 2);
  const f = x - i;
  const a = hexToRgb(AMBER_RAMP[i]);
  const b = hexToRgb(AMBER_RAMP[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function rampColorAlpha(t: number, alpha: number): string {
  return rampColor(t).replace("rgb(", "rgba(").replace(")", `,${alpha})`);
}

export const scoreColor = (score: number): string => rampColor((score - 1) / 9);
