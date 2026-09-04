import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024; // 3MB cap on the HTML response
const MAX_COPY_CHARS = 6000;
const MIN_COPY_CHARS = 120;
const USER_AGENT =
  "Mozilla/5.0 (compatible; IntuitiveMessagingBot/1.0; +https://intuitivewebsites.com)";

export class ExtractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function normalizeUrl(input) {
  const raw = (input || "").trim();
  if (!raw) throw new ExtractError("INVALID_URL", "Enter a URL to grade.");

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new ExtractError(
      "INVALID_URL",
      "That doesn't look like a valid URL. Try something like example.com or https://example.com."
    );
  }

  if (!/\./.test(url.hostname) || url.hostname === "localhost") {
    throw new ExtractError(
      "INVALID_URL",
      "That doesn't look like a valid, public URL."
    );
  }

  return url.toString();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ExtractError(
        "TIMEOUT",
        "That page took too long to respond. It may be down, slow, or blocking automated requests."
      );
    }
    throw new ExtractError(
      "NETWORK_ERROR",
      "We couldn't reach that URL. Double-check it's correct and the site is live."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new ExtractError(
      "HTTP_ERROR",
      `The page returned an HTTP ${res.status} error. Check the URL and try again.`
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType && !contentType.includes("html")) {
    throw new ExtractError(
      "NOT_HTML",
      "That URL doesn't point to an HTML page we can read."
    );
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    return res.text();
  }

  const decoder = new TextDecoder();
  let received = 0;
  let html = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_BYTES) {
      controller.abort();
      break;
    }
    html += decoder.decode(value, { stream: true });
  }
  return html;
}

/**
 * Pulls visible, homepage-relevant text in document order (naturally favoring
 * the hero and the sections right after it) and strips everything that isn't
 * reader-facing copy.
 */
function extractCopy(html) {
  const $ = cheerio.load(html);

  $(
    "script, style, noscript, svg, iframe, nav, footer, form, template, [aria-hidden='true']"
  ).remove();

  const title = $("title").first().text().trim();

  const parts = [];
  let totalChars = 0;

  $("h1, h2, h3, p, li, blockquote, button, a").each((_, el) => {
    if (totalChars >= MAX_COPY_CHARS) return false;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    parts.push(text);
    totalChars += text.length;
  });

  const copy = parts.join("\n").slice(0, MAX_COPY_CHARS);
  return { title, copy };
}

export async function fetchAndExtract(inputUrl) {
  const url = normalizeUrl(inputUrl);
  const html = await fetchHtml(url);
  const { title, copy } = extractCopy(html);

  if (copy.replace(/\s+/g, "").length < MIN_COPY_CHARS) {
    throw new ExtractError(
      "THIN_CONTENT",
      "We couldn't find enough readable text on that page. It may render its content with JavaScript, which we can't see, or the page may be mostly images."
    );
  }

  return { url, title, copy };
}
