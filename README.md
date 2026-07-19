# When to Post 🌍

An interactive 3D globe that shows the best time to post on social media for any
country, in that country's own timezone — scored 1–10, animated like a weather map.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![globe.gl](https://img.shields.io/badge/globe.gl-three.js-blue)

## What it does

- **Spinnable 3D globe** with a real day/night terminator (the sun's position is
  computed live) and city lights on the night side.
- **Heat choropleth**: every country is colored by its 1–10 post score *right now*
  (or at any simulated time) — watch the wave of prime posting hours roll west
  with the sun using the time-lapse player.
- **Click or search a country** → panel with a 1–10 score dial, why-breakdown
  (audience online × platform window), the best windows in the next 24h
  (shown in both the country's time and yours — click one to jump the map there),
  and a 24-hour activity chart.
- **Six platforms**: Facebook, Instagram, TikTok, X, LinkedIn, YouTube.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## How the score works

`score = geometric_mean(audience_online, platform_window)`, scaled against that
country + platform's best hour of the week — so 10/10 means "this country's best
possible slot", not a cross-country comparison.

- **Audience online** — the country's daily internet-traffic rhythm in local time.
  Ships with a modeled diurnal curve (peaks ~8–9pm local, weekday/weekend variants,
  per-country jitter). Swap in **real measured data** with one command:

  ```bash
  # free token: dash.cloudflare.com → My Profile → API Tokens → "Read Radar data"
  CLOUDFLARE_API_TOKEN=xxx npm run fetch-radar
  ```

  This pulls 7 days of hourly per-country traffic from the Cloudflare Radar API
  and rewrites `src/data/traffic.json` (CC BY-NC 4.0 — review before commercial use).

## Live data (all free)

Two live layers activate once `CLOUDFLARE_API_TOKEN` is available:

1. **Weekly auto-refresh** — `.github/workflows/refresh-traffic.yml` re-runs
   `fetch-radar` every Monday and commits the fresh curves (GitHub Actions free
   tier; ~2 min/week). Add the token as a repo secret:
   *GitHub repo → Settings → Secrets and variables → Actions → New repository
   secret → name `CLOUDFLARE_API_TOKEN`*. Each commit auto-redeploys on Vercel.
2. **Live pulse** — `/api/pulse?country=BD` compares a country's traffic right
   now against its usual level for that hour (cached 30 min per country). The
   country panel shows it as a pulsing "Live:" chip. Locally: copy
   `.env.example` to `.env.local`, paste the token, restart the dev server.
   On Vercel: *Project → Settings → Environment Variables →
   `CLOUDFLARE_API_TOKEN`*. Without the token everything still works — the
   chip simply stays hidden.

- **Platform window** — peak-engagement windows per platform per weekday, encoded
  from the 2026 Sprout Social (~2B engagements) and Buffer (52M posts) studies.

Honest caveats (also in the app's ? dialog): the studies skew US/English-speaking,
being online ≠ engaging, and your own audience beats any population model.

## Deploy

Zero-config on [Vercel](https://vercel.com): push to GitHub → import. All data is
static JSON baked at build time — no runtime APIs, no database, no per-visitor
cost. To keep Radar data fresh, run `npm run fetch-radar` on a schedule (e.g. a
weekly GitHub Action that commits `traffic.json`).

## Roadmap ideas

- **Phase 3 — personalization**: "Connect Instagram/Facebook" via Meta Graph API
  (`online_followers` / Page insights) to overlay *your* followers' activity.
  Requires Meta App Review for `instagram_manage_insights` / `pages_read_engagement`.
- Sub-national view for large countries (per-timezone bands).
- Score export / posting-schedule ICS download.

## Data & assets

- Country geometry: [world-atlas](https://github.com/topojson/world-atlas) 110m (public domain)
- Earth textures: NASA Blue Marble / Earth at Night (public domain, via three-globe)
- Country metadata: world-countries; timezones: countries-and-timezones
- Regenerate datasets: `npm run build-data`
