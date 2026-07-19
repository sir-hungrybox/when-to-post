"use client";

import { useMemo, useRef, useState } from "react";
import { activityAt, engagementAt, scoreAt } from "@/lib/score";
import { localParts } from "@/lib/time";
import { SERIES_BLUE } from "@/lib/colors";
import type { PlatformId } from "@/lib/platforms";

interface Props {
  a2: string;
  tz: string;
  platform: PlatformId;
  simTime: number;
}

const X0 = 10, X1 = 330, Y0 = 14, Y1 = 118;
const xAt = (h: number) => X0 + (h / 24) * (X1 - X0);
const yAt = (v: number) => Y1 - v * (Y1 - Y0);

export default function ActivityChart({ a2, tz, platform, simTime }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const date = new Date(simTime);
  const { hourFloat, dow, isWeekend } = localParts(tz, date);

  const { areaPath, linePath, actEnd, engEnd } = useMemo(() => {
    const pts: string[] = [];
    const line: string[] = [];
    for (let h = 0; h <= 24; h += 0.5) {
      pts.push(`${xAt(h).toFixed(1)},${yAt(activityAt(a2, h % 24, isWeekend)).toFixed(1)}`);
      line.push(`${xAt(h).toFixed(1)},${yAt(engagementAt(platform, dow, h % 24)).toFixed(1)}`);
    }
    return {
      areaPath: `M${X0},${Y1} L${pts.join(" L")} L${X1},${Y1} Z`,
      linePath: `M${line.join(" L")}`,
      actEnd: yAt(activityAt(a2, 23.99, isWeekend)),
      engEnd: yAt(engagementAt(platform, dow, 23.99)),
    };
  }, [a2, platform, dow, isWeekend]);

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const h = Math.round(((frac * 340 - X0) / (X1 - X0)) * 24 * 2) / 2;
    setHoverHour(h >= 0 && h <= 24 ? h : null);
  };

  const hover = hoverHour !== null
    ? {
        hour: hoverHour,
        act: activityAt(a2, hoverHour % 24, isWeekend),
        eng: engagementAt(platform, dow, hoverHour % 24),
      }
    : null;

  // score at hovered hour: shift sim date to that local hour
  const hoverScore = hover
    ? scoreAt(a2, platform, new Date(simTime + (hover.hour - hourFloat) * 3600e3)).score
    : null;

  const fmtH = (h: number) => {
    const hh = Math.floor(h) % 24;
    const mm = h % 1 ? "30" : "00";
    return `${String(hh).padStart(2, "0")}:${mm}`;
  };

  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow];

  // keep the two end-of-line direct labels from colliding
  const labelsClash = Math.abs(actEnd - engEnd) < 14;

  return (
    <div className="chart-block">
      <div className="chart-caption">
        {dayName} · {isWeekend ? "weekend" : "weekday"} pattern · local time
      </div>
      <div ref={wrapRef} className="chart-wrap" onMouseMove={onMove} onMouseLeave={() => setHoverHour(null)}>
        <svg viewBox="0 0 340 150" role="img" aria-label={`24-hour audience activity and platform engagement for ${dayName}`}>
          {[0.5, 1].map((v) => (
            <line key={v} x1={X0} x2={X1} y1={yAt(v)} y2={yAt(v)} stroke="#2c2c2a" strokeWidth="1" />
          ))}
          <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="#383835" strokeWidth="1" />
          {[0, 6, 12, 18, 24].map((h) => (
            <text key={h} x={xAt(h)} y={Y1 + 14} textAnchor="middle" className="tick-label">
              {h}h
            </text>
          ))}

          <path d={areaPath} fill="rgba(244,180,31,0.22)" />
          <path d={areaPath.replace(/^M[^L]+L/, "M").replace(/ L[\d.]+,[\d.]+ Z$/, "")} fill="none" stroke="#f4b41f" strokeWidth="2" strokeLinejoin="round" />
          <path d={linePath} fill="none" stroke={SERIES_BLUE} strokeWidth="2" strokeLinejoin="round" />

          <text x={X1 - 8} y={labelsClash ? Math.min(actEnd, engEnd) - 8 : actEnd - 6} className="direct-label" fill="#f4b41f" textAnchor="end">
            Audience
          </text>
          <text x={X1 - 8} y={labelsClash ? Math.max(actEnd, engEnd) + 14 : engEnd - 6} className="direct-label" fill={SERIES_BLUE} textAnchor="end">
            Window
          </text>

          {/* now marker */}
          <line x1={xAt(hourFloat)} x2={xAt(hourFloat)} y1={Y0 - 4} y2={Y1} stroke="#ffd166" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={xAt(hourFloat)} cy={yAt(activityAt(a2, hourFloat, isWeekend))} r="4" fill="#ffd166" stroke="#0d0d0d" strokeWidth="2" />

          {hover && (
            <g>
              <line x1={xAt(hover.hour)} x2={xAt(hover.hour)} y1={Y0} y2={Y1} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <circle cx={xAt(hover.hour)} cy={yAt(hover.act)} r="3.5" fill="#f4b41f" stroke="#0d0d0d" strokeWidth="2" />
              <circle cx={xAt(hover.hour)} cy={yAt(hover.eng)} r="3.5" fill={SERIES_BLUE} stroke="#0d0d0d" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover && (
          <div className="chart-tooltip" style={{ left: `${(xAt(hover.hour) / 340) * 100}%` }}>
            <b>{fmtH(hover.hour)}</b>
            <span>Audience {Math.round(hover.act * 100)}%</span>
            <span>Window {Math.round(hover.eng * 100)}%</span>
            <span>Score {hoverScore}/10</span>
          </div>
        )}
      </div>
      <div className="chart-legend">
        <span><i className="swatch" style={{ background: "#f4b41f" }} />Audience online</span>
        <span><i className="swatch" style={{ background: SERIES_BLUE }} />Platform window</span>
        <span><i className="swatch swatch-line" style={{ borderColor: "#ffd166" }} />Map time</span>
      </div>
    </div>
  );
}
