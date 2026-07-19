"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { COUNTRIES, scoreAt, trafficSource } from "@/lib/score";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { AMBER_RAMP } from "@/lib/colors";
import CountryPanel from "@/components/CountryPanel";
import CountrySearch from "@/components/CountrySearch";
import TimeBar from "@/components/TimeBar";
import InfoModal from "@/components/InfoModal";

const GlobeView = dynamic(() => import("@/components/GlobeView"), {
  ssr: false,
  loading: () => <div className="globe-loading">Loading the planet…</div>,
});

export default function Home() {
  const [nowMs, setNowMs] = useState(0); // set on mount to avoid hydration mismatch
  const [offsetMin, setOffsetMin] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [platform, setPlatform] = useState<PlatformId>("facebook");
  const [selected, setSelected] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // keep "now" fresh while resting at the live position
  useEffect(() => {
    if (offsetMin !== 0 || playing) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [offsetMin, playing]);

  // time-lapse: ~1 simulated hour per second, looping over 48h
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setOffsetMin((m) => (m + 10) % 2880), 150);
    return () => clearInterval(id);
  }, [playing]);

  const simTime = nowMs + offsetMin * 60_000;

  const scores = useMemo(() => {
    const d = new Date(simTime);
    const m = new Map<string, number>();
    for (const c of COUNTRIES) m.set(c.a2, scoreAt(c.a2, platform, d).score);
    return m;
  }, [simTime, platform]);

  const jumpTo = (timeMs: number) => {
    setPlaying(false);
    setOffsetMin(Math.max(0, Math.min(2880, Math.round((timeMs - nowMs) / 60_000 / 15) * 15)));
  };

  if (!nowMs) return <div className="globe-loading">Loading the planet…</div>;

  return (
    <main className="app">
      <GlobeView simTime={simTime} scores={scores} selected={selected} onSelect={setSelected} />

      <div className="topbar">
        <div className="brand">
          <h1>When to Post</h1>
          <span className="tagline">global posting-time heatmap</span>
        </div>
        <nav className="platforms" aria-label="Platform">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              className={p.id === platform ? "active" : ""}
              onClick={() => setPlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <CountrySearch onSelect={setSelected} />
          <button className="icon-btn info-btn" onClick={() => setShowInfo(true)} aria-label="How the score works">
            ?
          </button>
        </div>
      </div>

      <div className="legend">
        <div
          className="legend-ramp"
          style={{ background: `linear-gradient(90deg, ${AMBER_RAMP.join(",")})` }}
        />
        <div className="legend-labels">
          <span>1 · poor</span>
          <span>post score at map time</span>
          <span>10 · prime</span>
        </div>
        {trafficSource === "cloudflare-radar" && (
          <div className="legend-live">
            <i className="pulse-dot" aria-hidden /> live Cloudflare Radar data · refreshed weekly
          </div>
        )}
      </div>

      <TimeBar
        offsetMin={offsetMin}
        playing={playing}
        simTime={simTime}
        onOffsetChange={(m) => {
          setPlaying(false);
          setOffsetMin(m);
        }}
        onPlayToggle={() => setPlaying((p) => !p)}
      />

      {selected && (
        <CountryPanel
          a2={selected}
          simTime={simTime}
          platform={platform}
          onClose={() => setSelected(null)}
          onJumpTo={jumpTo}
        />
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </main>
  );
}
