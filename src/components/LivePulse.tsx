"use client";

import { useEffect, useState } from "react";

interface Pulse {
  available: boolean;
  deltaPct?: number;
  asOf?: string | null;
}

// Renders nothing until the live endpoint has data (i.e. a Cloudflare token
// is configured server-side), so the app degrades gracefully without it.
export default function LivePulse({ a2 }: { a2: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPulse(null);
    fetch(`/api/pulse?country=${a2}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled) setPulse(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [a2]);

  if (!pulse?.available || pulse.deltaPct === undefined) return null;

  const d = pulse.deltaPct;
  const text =
    Math.abs(d) <= 5
      ? "traffic in line with its usual level for this hour"
      : d > 0
        ? `traffic ${d}% busier than usual for this hour`
        : `traffic ${Math.abs(d)}% quieter than usual for this hour`;

  return (
    <div className="live-pulse" title={pulse.asOf ? `Cloudflare Radar, as of ${new Date(pulse.asOf).toLocaleString()}` : undefined}>
      <i className="pulse-dot" aria-hidden />
      <span>
        <b>Live:</b> {text}
      </span>
    </div>
  );
}
