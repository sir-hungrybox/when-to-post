"use client";

import { useMemo } from "react";
import {
  bestWindows,
  countryByA2,
  curvesFor,
  scoreAt,
  scoreLabel,
  trafficSource,
} from "@/lib/score";
import { platformById, type PlatformId } from "@/lib/platforms";
import { formatInTz, viewerTz } from "@/lib/time";
import { scoreColor, SERIES_BLUE } from "@/lib/colors";
import ActivityChart from "./ActivityChart";
import LivePulse from "./LivePulse";

interface Props {
  a2: string;
  simTime: number;
  platform: PlatformId;
  onClose: () => void;
  onJumpTo: (timeMs: number) => void;
}

const flagEmoji = (a2: string) =>
  String.fromCodePoint(...[...a2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function ScoreDial({ score }: { score: number }) {
  const sweep = 240; // degrees
  const r = 40;
  const circumference = (sweep / 360) * 2 * Math.PI * r;
  const frac = (score - 1) / 9;
  return (
    <svg viewBox="0 0 110 92" className="score-dial" role="img" aria-label={`Post score ${score} out of 10`}>
      <g transform="rotate(150 55 52)">
        <circle
          cx="55" cy="52" r={r} fill="none" stroke="#2c2c2a" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${circumference} 999`}
        />
        <circle
          cx="55" cy="52" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${Math.max(circumference * frac, 2)} 999`}
        />
      </g>
      <text x="55" y="52" textAnchor="middle" className="dial-number">{score}</text>
      <text x="55" y="68" textAnchor="middle" className="dial-sub">/ 10</text>
    </svg>
  );
}

export default function CountryPanel({ a2, simTime, platform, onClose, onJumpTo }: Props) {
  const meta = countryByA2.get(a2);
  const date = new Date(simTime);
  const vtz = viewerTz();

  const breakdown = useMemo(() => scoreAt(a2, platform, date), [a2, platform, simTime]); // eslint-disable-line react-hooks/exhaustive-deps
  const windows = useMemo(() => bestWindows(a2, platform, date), [a2, platform, simTime]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta || !curvesFor(a2)) return null;

  const pf = platformById(platform);
  const sameTz = meta.tz === vtz;

  const fmtWin = (start: Date, end: Date, tz: string) =>
    `${formatInTz(tz, start, { weekday: "short" })} – ${formatInTz(tz, end)}`;

  const nextBetter =
    breakdown.score < 7 && windows.length
      ? Math.max(0, windows.map((w) => w.start.getTime()).sort((x, y) => x - y)[0] - simTime)
      : null;
  const fmtDelta = (ms: number) => {
    const h = Math.floor(ms / 3600e3);
    const m = Math.round((ms % 3600e3) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <aside className="panel">
      <header className="panel-header">
        <div>
          <h2>
            <span className="flag">{flagEmoji(a2)}</span> {meta.name}
          </h2>
          <div className="panel-subtitle">
            {formatInTz(meta.tz, date, { weekday: "long", hour: "numeric", minute: "2-digit" })} · {meta.tz.replace(/_/g, " ")}
            {meta.multiTz && <span className="tz-note"> (spans multiple timezones — using the main one)</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">✕</button>
      </header>

      <section className="score-section">
        <ScoreDial score={breakdown.score} />
        <div className="score-meta">
          <div className="score-verdict" style={{ color: scoreColor(breakdown.score) }}>
            {scoreLabel(breakdown.score)}
          </div>
          <div className="score-context">to post on {pf.label} right now (map time)</div>
          {nextBetter !== null && (
            <button className="jump-hint" onClick={() => onJumpTo(simTime + nextBetter)}>
              Better window in {fmtDelta(nextBetter)} →
            </button>
          )}
        </div>
      </section>

      <LivePulse a2={a2} />

      <section className="breakdown">
        <div className="bar-row">
          <span className="bar-label">Audience online</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round(breakdown.activity * 100)}%`, background: "#f4b41f" }} />
          </div>
          <span className="bar-value">{Math.round(breakdown.activity * 100)}%</span>
        </div>
        <div className="bar-row">
          <span className="bar-label">{pf.label} window</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round(breakdown.engagement * 100)}%`, background: SERIES_BLUE }} />
          </div>
          <span className="bar-value">{Math.round(breakdown.engagement * 100)}%</span>
        </div>
      </section>

      <section>
        <h3>Best windows · next 24h</h3>
        {windows.length === 0 && <div className="empty-note">No strong window in the next 24h — try another day.</div>}
        <div className="windows">
          {windows.map((w) => (
            <button
              key={w.start.getTime()}
              className="window-chip"
              onClick={() => onJumpTo(w.start.getTime())}
              title="Jump the map to this time"
            >
              <i style={{ background: scoreColor(w.peakScore) }} />
              <span className="win-local">{fmtWin(w.start, w.end, meta.tz)}</span>
              {!sameTz && <span className="win-viewer">your time {fmtWin(w.start, w.end, vtz)}</span>}
              <span className="win-score">peak {w.peakScore}/10</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Typical day in {meta.name}</h3>
        <ActivityChart a2={a2} tz={meta.tz} platform={platform} simTime={simTime} />
      </section>

      <footer className="panel-footer">
        <p><b>{pf.label}:</b> {pf.bestKnown} <span className="muted">(Sprout Social &amp; Buffer, 2026 studies)</span></p>
        <p className="muted">
          Audience curve: {trafficSource === "cloudflare-radar"
            ? "live Cloudflare Radar traffic data."
            : "modeled daily internet rhythm — run `npm run fetch-radar` with a free Cloudflare token for live per-country data."}
        </p>
      </footer>
    </aside>
  );
}
