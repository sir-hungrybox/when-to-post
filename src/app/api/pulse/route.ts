import { NextRequest, NextResponse } from "next/server";

// Live traffic pulse for one country: latest hourly Cloudflare Radar value
// vs. the average for that same hour over the past week. Responses are
// cached 30 min per country to stay well inside Radar's free-tier limits.
// Without CLOUDFLARE_API_TOKEN set, reports unavailable and the UI hides it.
export async function GET(req: NextRequest) {
  const a2 = req.nextUrl.searchParams.get("country")?.toUpperCase();
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return NextResponse.json({ available: false, reason: "no-token" });
  if (!a2 || !/^[A-Z]{2}$/.test(a2)) {
    return NextResponse.json({ available: false, reason: "bad-country" }, { status: 400 });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/radar/netflows/timeseries?location=${a2}&dateRange=7d&aggInterval=1h&format=json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return NextResponse.json({ available: false, reason: `radar-${res.status}` });

    const json = await res.json();
    const serie = json?.result?.serie_0;
    const timestamps: string[] = serie?.timestamps ?? [];
    const values: number[] = (serie?.values ?? []).map(Number);
    if (values.length < 48) return NextResponse.json({ available: false, reason: "insufficient-data" });

    const current = values[values.length - 1];
    // same hour of day on previous days
    const priors: number[] = [];
    for (let i = values.length - 1 - 24; i >= 0; i -= 24) {
      if (Number.isFinite(values[i])) priors.push(values[i]);
    }
    if (!priors.length || !Number.isFinite(current)) {
      return NextResponse.json({ available: false, reason: "insufficient-data" });
    }
    const typical = priors.reduce((s, v) => s + v, 0) / priors.length;
    const deltaPct = typical > 0 ? Math.round(((current - typical) / typical) * 100) : 0;

    return NextResponse.json({
      available: true,
      deltaPct,
      asOf: timestamps[timestamps.length - 1] ?? null,
    });
  } catch {
    return NextResponse.json({ available: false, reason: "fetch-failed" });
  }
}
