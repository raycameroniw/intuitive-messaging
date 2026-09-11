"use client";

import { gradeTier } from "../lib/scoring";

const TIER_COLOR = {
  good: "var(--good)",
  mid: "var(--mid)",
  poor: "var(--poor)",
};

function segmentColor(score) {
  if (score >= 4) return TIER_COLOR.good;
  if (score === 3) return TIER_COLOR.mid;
  return TIER_COLOR.poor;
}

function Gauge({ score, max }) {
  return (
    <div className="gauge">
      <div className="gauge__segments">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`gauge__segment${i < score ? " gauge__segment--filled" : ""}`}
            style={i < score ? { "--seg-color": segmentColor(score) } : undefined}
          />
        ))}
      </div>
      <span className="gauge__value">
        {score}/{max}
      </span>
    </div>
  );
}

export default function Report({ data, onReset }) {
  const tier = gradeTier(data.grade);
  const tierColor = TIER_COLOR[tier];

  return (
    <div className="report">
      <p className="report__target">
        GRADED:{" "}
        <a href={data.url} target="_blank" rel="noreferrer noopener">
          {data.url}
        </a>
      </p>

      <div className="scorehead">
        <span className="corner corner--tl" />
        <span className="corner corner--tr" />
        <span className="corner corner--bl" />
        <span className="corner corner--br" />

        <div className="stamp" style={{ "--tier-color": tierColor }}>
          <span className="stamp__grade">{data.grade}</span>
        </div>

        <div className="scorehead__data">
          <div className="scorehead__label">Conversion readiness grade</div>
          <div className="scorehead__score" style={{ "--tier-color": tierColor }}>
            {data.totalScore}
            <span>/{data.maxScore}</span>
          </div>
          <p className="scorehead__summary">{data.summary}</p>
        </div>
      </div>

      <div className="signals">
        {data.signals.map((s) => (
          <div className="signal-card" key={s.key}>
            <h3 className="signal-card__name">{s.name}</h3>
            <Gauge score={s.score} max={s.max} />
            <p className="signal-card__feedback">{s.feedback}</p>
          </div>
        ))}
      </div>

      <div className="rewrite">
        <div className="rewrite__head">
          FIX THIS FIRST
          <span className="rewrite__target">— {data.weakestSignalName}</span>
        </div>
        <div className="rewrite__body">
          <p className="rewrite__text">{data.rewrite}</p>
          <p className="rewrite__hint">
            Drop-in fix. Swap in your own specifics before you ship it.
          </p>
        </div>
      </div>

      <div className="again">
        <button type="button" onClick={onReset}>
          Grade another homepage
        </button>
      </div>
    </div>
  );
}
