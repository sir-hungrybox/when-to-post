"use client";

import { useMemo, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/score";

interface Props {
  onSelect: (a2: string) => void;
}

export default function CountrySearch({ onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [q]);

  const pick = (a2: string) => {
    onSelect(a2);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        value={q}
        placeholder="Search a country…"
        aria-label="Search a country"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && matches[highlight]) pick(matches[highlight].a2);
          else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="search-results" role="listbox">
          {matches.map((c, i) => (
            <li key={c.a2} role="option" aria-selected={i === highlight}>
              <button
                className={i === highlight ? "hl" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(c.a2)}
              >
                {c.name} <span className="muted">{c.tz.split("/").pop()?.replace(/_/g, " ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
