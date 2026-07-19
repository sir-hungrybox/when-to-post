/**
 * Replaces the baseline traffic model with real per-country traffic curves
 * from the Cloudflare Radar API (free token: https://dash.cloudflare.com →
 * My Profile → API Tokens → "Read Radar data" template).
 *
 *   CLOUDFLARE_API_TOKEN=xxx npm run fetch-radar
 *
 * Pulls 7 days of hourly netflows per country, buckets each UTC timestamp
 * into the country's local hour (weekday vs weekend), averages, and writes
 * the same traffic.json shape the app already reads.
 *
 * Radar data is licensed CC BY-NC 4.0 — fine for a free tool, review before
 * commercial use.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN. Get a free token at https://dash.cloudflare.com/profile/api-tokens");
  process.exit(1);
}

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const countries = JSON.parse(readFileSync(path.join(dataDir, "countries.json"), "utf8"));
const existing = JSON.parse(readFileSync(path.join(dataDir, "traffic.json"), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function localHourAndDay(dateIso, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date(dateIso));
  const hour = +parts.find((p) => p.type === "hour").value;
  const wd = parts.find((p) => p.type === "weekday").value;
  return { hour, weekend: wd === "Sat" || wd === "Sun" };
}

async function fetchCountry(c) {
  const url = `https://api.cloudflare.com/client/v4/radar/netflows/timeseries?location=${c.a2}&dateRange=7d&aggInterval=1h&format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const serie = json?.result?.serie_0;
  if (!serie?.timestamps?.length) throw new Error("empty series");

  const sums = { weekday: new Array(24).fill(0), weekend: new Array(24).fill(0) };
  const counts = { weekday: new Array(24).fill(0), weekend: new Array(24).fill(0) };
  serie.timestamps.forEach((ts, i) => {
    const v = +serie.values[i];
    if (!Number.isFinite(v)) return;
    const { hour, weekend } = localHourAndDay(ts, c.tz);
    const bucket = weekend ? "weekend" : "weekday";
    sums[bucket][hour] += v;
    counts[bucket][hour] += 1;
  });
  const curve = (bucket) => {
    const avg = sums[bucket].map((s, h) => (counts[bucket][h] ? s / counts[bucket][h] : 0));
    const max = Math.max(...avg);
    if (max <= 0) throw new Error(`no ${bucket} data`);
    return avg.map((v) => +(v / max).toFixed(3));
  };
  return { weekday: curve("weekday"), weekend: curve("weekend") };
}

let ok = 0, failed = 0;
for (const c of countries) {
  try {
    existing.countries[c.a2] = await fetchCountry(c);
    ok++;
  } catch (e) {
    failed++; // keep the baseline curve for this country
    console.warn(`  ${c.a2} ${c.name}: ${e.message} (keeping baseline)`);
  }
  await sleep(150); // stay well under Radar rate limits
}

existing.meta = {
  source: "cloudflare-radar",
  fetchedAt: new Date().toISOString(),
  license: "CC BY-NC 4.0 (Cloudflare Radar)",
  coverage: `${ok} live, ${failed} baseline`,
};
writeFileSync(path.join(dataDir, "traffic.json"), JSON.stringify(existing));
console.log(`Done: ${ok} countries live from Radar, ${failed} kept baseline.`);
