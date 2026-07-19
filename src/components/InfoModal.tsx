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
            actually awake and online), measured live by Cloudflare Radar and{" "}
            <b className="hl-amber">auto-refreshed every week</b>.
          </li>
          <li>
            <b>Platform window</b> — when each platform's engagement peaks, from large-scale 2026
            engagement data covering roughly two billion interactions.
          </li>
        </ul>
        <p>
          The two are multiplied (both must be high), then scaled against that country's best hour of the
          week — so <b>10/10 means "this country's best possible slot"</b>, not a global comparison.
        </p>
        <p className="muted">
          Honest caveats: platform engagement data skews toward US/English-speaking accounts; being
          online isn't identical to engaging; and your own audience may differ — platform-native
          analytics (e.g. Instagram's follower activity) beat any population model once you have them.
          Multi-timezone countries use their most populous zone.
        </p>
      </div>
    </div>
  );
}
