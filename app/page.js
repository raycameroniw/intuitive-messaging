"use client";

import { useEffect, useRef, useState } from "react";
import UrlForm from "../components/UrlForm";
import Report from "../components/Report";

const LOADING_STEPS = [
  "Fetching homepage…",
  "Checking for a blog or resources section…",
  "Reading hero, CTAs, and offers…",
  "Grading against 5 funnel signals…",
];

function useLoadingSteps(active) {
  const [step, setStep] = useState(0);
  const ref = useRef();

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    ref.current = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2600);
    return () => clearInterval(ref.current);
  }, [active]);

  return step;
}

export default function Page() {
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const step = useLoadingSteps(status === "loading");

  async function handleSubmit(url) {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong grading that page.");
        setStatus("error");
        return;
      }
      setReport(data);
      setStatus("done");
    } catch {
      setError("Something went wrong on our end. Try again in a moment.");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setReport(null);
  }

  return (
    <div className="shell">
      <header className="titleblock">
        <div className="titleblock__mark">
          <span className="bracket">[</span>
          <span className="titleblock__name">INTUITIVE CONVERSION</span>
          <span className="bracket">]</span>
        </div>
        <div className="titleblock__meta">
          FREE — NO SIGNUP
          <br />
          READOUT: ~30 SEC
        </div>
      </header>

      {status !== "done" && (
        <div className="hero">
          <h1>Is your homepage built to convert, or just to exist?</h1>
          <p>
            Paste your homepage URL. Get a graded read on whether your site
            is actually built to move a technical buyer toward a sales
            conversation — or just sits there looking professional.
          </p>
          <ul className="hero__rubric">
            <li>Benefit vs. feature framing</li>
            <li>Bottom-of-funnel CTA</li>
            <li>Mid-funnel offer</li>
            <li>Resources section</li>
            <li>Blog currency &amp; quality</li>
          </ul>

          <UrlForm onSubmit={handleSubmit} disabled={status === "loading"} />
          <p className="form-note">
            We read the live page server-side, grade it, and never store the
            URL or the copy.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div className="loading">
          <div className="loading__bar" />
          <div className="loading__line">
            <span>&gt;</span> {LOADING_STEPS[step]}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="error-panel">
          <span className="error-panel__glyph">!</span>
          <div className="error-panel__body">
            <h3>Couldn't grade that page</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {status === "done" && report && <Report data={report} onReset={reset} />}

      <footer className="footer">
        <span>Intuitive Conversion — built by Intuitive Websites</span>
        <a href="https://intuitivewebsites.com" target="_blank" rel="noreferrer noopener">
          intuitivewebsites.com
        </a>
      </footer>
    </div>
  );
}
