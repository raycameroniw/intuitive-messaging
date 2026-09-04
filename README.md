# Intuitive Messaging

Free, instant homepage messaging grader for manufacturers, machine shops, and
contract manufacturers — a lead magnet for Intuitive Websites' manufacturing
vertical.

A visitor pastes a homepage URL. The server fetches that page, strips nav/
footer/scripts, and grades the remaining copy against 5 buyer-facing
messaging signals using the Claude API. No signup required for the grade
itself.

## How it works

1. `components/UrlForm.js` collects a URL and posts it to `/api/grade`.
2. `app/api/grade/route.js` (server-only) fetches the page, extracts visible
   copy with `lib/extractContent.js` (Cheerio), and sends it to Claude with
   the rubric in `lib/buildPrompt.js`.
3. Claude returns strict JSON (score + feedback per signal, a rewrite for the
   weakest signal). The server recomputes the total/letter grade itself so
   the math is always consistent, and renders the result via
   `components/Report.js`.

The Anthropic API key is read server-side only (`ANTHROPIC_API_KEY`) and is
never sent to the browser.

## Local setup

This was built without a local Node.js environment available, so it has
**not been run with `npm install` / `npm run dev` yet** — treat the first
local run as a real test pass, not a formality. Node 20+ recommended.

```bash
npm install
cp .env.example .env.local
# then edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 and grade a real manufacturer homepage. Things
worth checking specifically:

- A normal WordPress/static manufacturer site grades cleanly.
- A heavy JS/SPA site (little text in the initial HTML) hits the
  "couldn't find enough readable text" error, not a crash.
- A bad/typo'd domain hits the network error message, not a crash.
- Mobile widths (the URL form and signal cards collapse to one column under
  560px).

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In Vercel: **New Project** → import the repo → framework preset
   auto-detects Next.js.
3. Add environment variable `ANTHROPIC_API_KEY` (Production + Preview).
   `ANTHROPIC_MODEL` is optional, defaults to `claude-sonnet-5`.
4. Deploy. Vercel builds it server-side, so no local Node install is
   required on your machine either — the Vercel build is the first real
   compile/typecheck pass this code will get.
5. Point your subdomain: in Vercel's project → **Domains**, add
   `messaging.intuitivewebsites.com` (or whatever you prefer), then add the
   CNAME record it gives you in your DNS provider for
   `intuitivewebsites.com`.

## Known limitations / follow-ups

- **JS-rendered homepages**: this does a plain server-side `fetch`, not a
  headless browser, so sites that render their hero copy client-side (heavy
  React/Vue SPAs with an empty initial HTML shell) will fail extraction.
  Fixable later with a headless-render fallback (e.g. Browserless/Playwright)
  if this turns out to matter for the target list of manufacturer sites.
- **No lead capture yet.** Per the build brief, this ships the free grade
  only. The natural next step: gate "get the rewritten version of your
  weakest section" (or the full PDF) behind an email field, wired to
  HubSpot — without touching the free grade/score, which should stay
  instant and gate-free.
- **No rate limiting.** Since it's a public, unauthenticated endpoint that
  calls a paid API, consider adding basic IP rate limiting (e.g. Vercel
  Edge Config / Upstash) before heavy traffic, so one visitor can't run up
  the Anthropic bill by spamming URLs.
