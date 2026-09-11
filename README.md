# Intuitive Conversion

Free, instant conversion-funnel grader for manufacturer homepages — v1,
individual-site version, built as the starting point for Tom's MD&M
research project.

This replaced an earlier tool (Intuitive Messaging, graded messaging
clarity for engineers/buyers) in this same repo and Vercel project. Same
fetch/extract engine and report UI, new rubric.

## Rubric (5 signals, graded 1-5)

Straight from Tom's research criteria:

1. **Benefit vs. Feature Framing** — customer outcome language vs. "about us"/feature-dump
2. **Bottom-of-Funnel CTA** — specific action ("Book a meeting") vs. generic ("Learn More")
3. **Mid-Funnel Offer** — ebook/webinar/guide vs. nothing between homepage and hard sales ask
4. **Resources Section** — present or not
5. **Blog Currency & Quality** — posted in 2026, human byline, genuine thought leadership (all three required for a top score)

## How it's different from Intuitive Messaging

Signals 4 and 5 can't be graded from the homepage alone, so this version
does a second fetch:

1. Fetch the homepage, extract copy (same engine as Intuitive Messaging).
2. Scan **every** link on the page (including nav/footer) for anything
   that looks like a blog or resources destination (`lib/extractContent.js`,
   `findCandidateLinks`). Blog matching is two-tier — an exact "blog" match
   is trusted on its own; weaker signals (news/insights) are only a fallback,
   since anything broader (e.g. "articles") collides with unrelated things
   like help-center URLs.
3. If a blog-like link was found, fetch that page too and extract its copy
   (post titles, dates, bylines) for Claude to judge currency/authorship/
   quality against.
4. If no blog/resources link exists at all, those signals just score low
   with "not found" feedback — no fabricated content.

## Known v1 limitations (by design — this is the starting point)

- **Homepage + one blog/resources page only.** It doesn't crawl individual
  blog posts or paginate through a blog archive to confirm "current" beyond
  what's visible on the index page itself. Good enough to start testing
  against; extend if the research needs more rigor.
- **Keyword-based link detection**, not a real site crawl. Sites whose blog
  lives behind a JS-rendered menu (not in the static HTML) or uses unusual
  labeling won't be found — same JS-rendering limitation as Intuitive
  Messaging's homepage fetch.
- **"Genuine thought leadership" is a judgment call**, not a fact-check.
  Claude makes a best-effort read from the blog index text (titles,
  excerpts, bylines) — treat it as directional, not an audit.
- **No bulk/batch mode yet.** This is the single-URL version to validate
  the rubric and extraction quality first, per plan: get this producing
  results you trust, then convert it into the 500-site research script.

## Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local, add your ANTHROPIC_API_KEY
npm run dev
```

Built and build-tested in this environment (Node 24, `npm run build` and
the report UI both verified against mock data), but **not yet tested
against the real Claude API** — no key was available in this environment.
First real end-to-end run should be treated as a real test, not a formality,
same as Intuitive Messaging's initial deploy (which needed one fix: Claude
Sonnet 5 rejects the `temperature` param — already omitted here from the
start).
