"use client";

import { viewerTz, formatInTz } from "@/lib/time";

interface Props {
  offsetMin: number;
  playing: boolean;
  simTime: number;
  onOffsetChange: (min: number) => void;
  onPlayToggle: () => void;
}

export default function TimeBar({ offsetMin, playing, simTime, onOffsetChange, onPlayToggle }: Props) {
  const vtz = viewerTz();
  const label = formatInTz(vtz, new Date(simTime), { weekday: "short", hour: "numeric", minute: "2-digit" });
  const offsetLabel =
    offsetMin === 0 ? "now" : `+${Math.floor(offsetMin / 60)}h${offsetMin % 60 ? ` ${offsetMin % 60}m` : ""}`;

  return (
    <div className="timebar">
      <button className="play-btn" onClick={onPlayToggle} aria-label={playing ? "Pause time-lapse" : "Play time-lapse"}>
        {playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor"/><rect x="10" y="2" width="4" height="12" rx="1" fill="currentColor"/></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={2880}
        step={15}
        value={offsetMin}
        aria-label="Scrub time over the next 48 hours"
        onChange={(e) => onOffsetChange(+e.target.value)}
      />
      <div className="time-readout">
        <b>{label}</b>
        <span className="muted">{offsetLabel}</span>
      </div>
      {offsetMin !== 0 && (
        <button className="now-btn" onClick={() => onOffsetChange(0)}>
          Back to now
        </button>
      )}
    </div>
  );
}
