"use client";

import { useEffect, useRef, useState } from "react";
import UrlForm from "../components/UrlForm";
import Report from "../components/Report";

const LOADING_STEPS = [
  "Fetching homepage…",
  "Stripping nav, footer, and scripts…",
  "Reading hero and top sections…",
  "Grading against 5 buyer signals…",
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
          <span className="titleblock__name">INTUITIVE MESSAGING</span>
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
          <h1>Would an engineer trust your homepage?</h1>
          <p>
            Paste your homepage URL. Get a graded read on whether your
            messaging speaks to a buyer with a print or an RFQ in hand — or
            just sounds like every other shop's website.
          </p>
          <ul className="hero__rubric">
            <li>Industry specificity</li>
            <li>Capability specificity</li>
            <li>Proof &amp; credibility</li>
            <li>Buyer outcome framing</li>
            <li>Clear next step</li>
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
        <span>Intuitive Messaging — built by Intuitive Websites</span>
        <a href="https://intuitivewebsites.com" target="_blank" rel="noreferrer noopener">
          intuitivewebsites.com
        </a>
      </footer>
    </div>
  );
}
