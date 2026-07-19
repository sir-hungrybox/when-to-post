"use client";

interface Props {
  onClose: () => void;
}

export default function InfoModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How the score works">
        <header>
          <h2>How the score works</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p>
          Each country's <b>1–10 post score</b> combines two signals, both in the audience's local time:
        </p>
        <ul>
          <li>
            <b>Audience online</b> — the country's daily internet-traffic rhythm (when people there are
            actually awake and online). Ships with a modeled curve; connect a free Cloudflare Radar API
            token and run <code>npm run fetch-radar</code> to replace it with real measured traffic per country.
          </li>
          <li>
            <b>Platform window</b> — when each platform's engagement peaks, from the 2026 Sprout Social
            (~2B engagements) and Buffer (52M posts) studies.
          </li>
        </ul>
        <p>
          The two are multiplied (both must be high), then scaled against that country's best hour of the
          week — so <b>10/10 means "this country's best possible slot"</b>, not a global comparison.
        </p>
        <p className="muted">
          Honest caveats: platform studies skew toward US/English-speaking accounts; being online isn't
          identical to engaging; and your own audience may differ — platform-native analytics (e.g.
          Instagram's follower activity) beat any population model once you have them. Multi-timezone
          countries use their most populous zone.
        </p>
      </div>
    </div>
  );
}
