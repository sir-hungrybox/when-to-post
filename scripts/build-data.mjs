/**
 * Generates src/data/countries.json and src/data/traffic.json.
 *
 * countries.json — one entry per country: name, ISO alpha-2, ISO numeric-3
 * (matches world-atlas polygon ids), centroid, primary IANA timezone.
 *
 * traffic.json — per-country 24h activity curves (weekday + weekend, local
 * time, normalized 0..1). Ships as a baseline diurnal model; run
 * `npm run fetch-radar` with CLOUDFLARE_API_TOKEN set to replace it with
 * real Cloudflare Radar traffic data (same file shape, source flag flips).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import worldCountries from "world-countries";
import ct from "countries-and-timezones";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
mkdirSync(outDir, { recursive: true });

// Primary timezone for multi-timezone countries: the zone of the population/
// media center, since a single "country local time" is needed for the map.
const TZ_OVERRIDES = {
  US: "America/New_York",
  CA: "America/Toronto",
  BR: "America/Sao_Paulo",
  RU: "Europe/Moscow",
  AU: "Australia/Sydney",
  MX: "America/Mexico_City",
  ID: "Asia/Jakarta",
  CN: "Asia/Shanghai",
  KZ: "Asia/Almaty",
  CD: "Africa/Kinshasa",
  MN: "Asia/Ulaanbaatar",
  PT: "Europe/Lisbon",
  ES: "Europe/Madrid",
  CL: "America/Santiago",
  EC: "America/Guayaquil",
  PG: "Pacific/Port_Moresby",
  NZ: "Pacific/Auckland",
  FR: "Europe/Paris",
  GB: "Europe/London",
  NL: "Europe/Amsterdam",
  DK: "Europe/Copenhagen",
  NO: "Europe/Oslo",
  UA: "Europe/Kyiv",
  GL: "America/Nuuk",
  AR: "America/Argentina/Buenos_Aires",
  DE: "Europe/Berlin",
  UZ: "Asia/Tashkent",
  PF: "Pacific/Tahiti",
  ZA: "Africa/Johannesburg",
  KI: "Pacific/Tarawa",
  FM: "Pacific/Pohnpei",
};

const countries = [];
for (const c of worldCountries) {
  if (c.cca2 === "AQ") continue; // Antarctica
  const tzInfo = ct.getCountry(c.cca2);
  const zones = tzInfo?.timezones ?? [];
  const tz = TZ_OVERRIDES[c.cca2] ?? zones[0];
  if (!tz || !Array.isArray(c.latlng) || c.latlng.length !== 2) continue;
  countries.push({
    name: c.name.common,
    a2: c.cca2,
    n3: c.ccn3, // world-atlas polygon id
    lat: c.latlng[0],
    lng: c.latlng[1],
    tz,
    multiTz: zones.length > 1,
  });
}
countries.sort((a, b) => a.name.localeCompare(b.name));

// --- Baseline diurnal curves ------------------------------------------------
// Shape (local time): overnight trough ~03-05, morning ramp, midday plateau,
// slight afternoon dip, evening peak ~20-21, late decline. Weekends start
// later and run higher through midday. Per-country deterministic jitter
// (peak shift ±1h, level ±6%) so the world map doesn't animate in lockstep.
const WEEKDAY = [
  0.30, 0.22, 0.16, 0.13, 0.13, 0.17, 0.28, 0.42, 0.55, 0.62, 0.66, 0.70,
  0.74, 0.73, 0.69, 0.68, 0.72, 0.78, 0.85, 0.93, 1.00, 0.98, 0.82, 0.55,
];
const WEEKEND = [
  0.36, 0.28, 0.20, 0.15, 0.13, 0.14, 0.20, 0.30, 0.45, 0.60, 0.72, 0.80,
  0.84, 0.82, 0.78, 0.76, 0.78, 0.82, 0.88, 0.95, 1.00, 0.97, 0.85, 0.62,
];

function hashCode(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sample base curve at (hour - shift) with linear interpolation, then jitter.
function makeCurve(base, rand) {
  const shift = (rand() - 0.5) * 2; // ±1h peak shift
  const out = [];
  for (let h = 0; h < 24; h++) {
    const x = (((h - shift) % 24) + 24) % 24;
    const i0 = Math.floor(x);
    const i1 = (i0 + 1) % 24;
    const frac = x - i0;
    let v = base[i0] * (1 - frac) + base[i1] * frac;
    v *= 1 + (rand() - 0.5) * 0.12; // ±6% level jitter
    out.push(v);
  }
  const max = Math.max(...out);
  return out.map((v) => +(v / max).toFixed(3));
}

const traffic = {};
for (const c of countries) {
  const rand = mulberry32(hashCode(c.a2));
  traffic[c.a2] = { weekday: makeCurve(WEEKDAY, rand), weekend: makeCurve(WEEKEND, rand) };
}

writeFileSync(path.join(outDir, "countries.json"), JSON.stringify(countries));
writeFileSync(
  path.join(outDir, "traffic.json"),
  JSON.stringify({
    meta: {
      source: "baseline-diurnal-model",
      note: "Modeled typical daily internet-activity rhythm per country (local time). Run `npm run fetch-radar` with CLOUDFLARE_API_TOKEN to replace with live Cloudflare Radar data.",
    },
    countries: traffic,
  })
);
console.log(`Wrote ${countries.length} countries + traffic curves to src/data/`);
