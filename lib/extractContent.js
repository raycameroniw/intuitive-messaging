import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024; // 3MB cap on the HTML response
const MAX_COPY_CHARS = 6000;
const MIN_COPY_CHARS = 120;
const USER_AGENT =
  "Mozilla/5.0 (compatible; IntuitiveConversionBot/1.0; +https://intuitivewebsites.com)";

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
    return { html: await res.text(), finalUrl: res.url || url };
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
  return { html, finalUrl: res.url || url };
}

/**
 * Pulls visible, homepage-relevant text in document order (naturally favoring
 * the hero and the sections right after it) and strips everything that isn't
 * reader-facing copy.
 */
function extractCopy(html, { maxChars = MAX_COPY_CHARS } = {}) {
  const $ = cheerio.load(html);

  $(
    "script, style, noscript, svg, iframe, nav, header, footer, form, template, [aria-hidden='true'], .skip-link, .sr-only, .visually-hidden, .screen-reader-text"
  ).remove();

  const title = $("title").first().text().trim();

  const parts = [];
  const seen = new Set();
  let totalChars = 0;

  $("h1, h2, h3, p, li, blockquote, button, a, time").each((_, el) => {
    if (totalChars >= maxChars) return false;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 2 || seen.has(text)) return;
    seen.add(text);
    parts.push(text);
    totalChars += text.length;
  });

  const copy = parts.join("\n").slice(0, maxChars);
  return { title, copy };
}

const BLOG_STRICT_KEYWORDS = ["blog"];
const BLOG_LOOSE_KEYWORDS = ["news", "insights", "newsroom"];
const RESOURCES_KEYWORDS = [
  "resources",
  "resource center",
  "knowledge",
  "learning center",
  "guides",
  "whitepapers",
  "case studies",
  "downloads",
  "ebook",
  "webinar",
];

function matchesKeyword(str, keywords) {
  const lower = str.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function registrableSuffix(hostname) {
  const labels = hostname.split(".");
  return labels.slice(-2).join(".");
}

/**
 * Scans every link on the page (including nav/footer, which extractCopy
 * strips for grading purposes) for anything that looks like a blog or
 * resources destination, so signal scoring can be grounded in what's
 * actually linked rather than left to guess from homepage copy alone.
 *
 * Blog matching is two-tier: an exact "blog" match is trusted on its own;
 * weaker signals (news/articles/insights) are only used as a fallback,
 * since "articles" in particular collides with unrelated things like
 * help-center KB article URLs.
 */
function findCandidateLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const baseSuffix = registrableSuffix(new URL(baseUrl).hostname);
  const blogStrict = [];
  const blogLoose = [];
  const resources = [];
  const seenHrefs = new Set();

  $("a[href]").each((_, el) => {
    const hrefRaw = $(el).attr("href");
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!hrefRaw || hrefRaw.startsWith("#") || hrefRaw.startsWith("mailto:") || hrefRaw.startsWith("tel:")) {
      return;
    }

    let href;
    try {
      href = new URL(hrefRaw, baseUrl);
    } catch {
      return;
    }
    if (registrableSuffix(href.hostname) !== baseSuffix) return;

    const hrefStr = href.toString();
    if (seenHrefs.has(hrefStr)) return;

    const haystack = `${text} ${hrefRaw}`;
    const isBlogStrict = matchesKeyword(haystack, BLOG_STRICT_KEYWORDS);
    const isBlogLoose = matchesKeyword(haystack, BLOG_LOOSE_KEYWORDS);
    const isResources = matchesKeyword(haystack, RESOURCES_KEYWORDS);
    if (!isBlogStrict && !isBlogLoose && !isResources) return;

    seenHrefs.add(hrefStr);
    const entry = { text: text || "(no link text)", href: hrefStr };
    if (isBlogStrict && blogStrict.length < 5) blogStrict.push(entry);
    else if (isBlogLoose && blogLoose.length < 5) blogLoose.push(entry);
    if (isResources && resources.length < 5) resources.push(entry);
  });

  let blog = blogStrict.length > 0 ? blogStrict : blogLoose;
  if (blog.length === 0 && resources.length > 0) {
    // Many manufacturer sites file their thought-leadership content under
    // "Resources" rather than a dedicated "Blog" — fall back to the
    // resources hub itself as the blog-quality check target. Prefer the
    // shortest-text entry as the likely index/hub page over a specific
    // article permalink.
    blog = [...resources].sort((a, b) => a.text.length - b.text.length);
  }

  return { blog, resources };
}

export async function fetchAndExtract(inputUrl) {
  const url = normalizeUrl(inputUrl);
  const { html, finalUrl } = await fetchHtml(url);
  const { title, copy } = extractCopy(html);

  if (copy.replace(/\s+/g, "").length < MIN_COPY_CHARS) {
    throw new ExtractError(
      "THIN_CONTENT",
      "We couldn't find enough readable text on that page. It may render its content with JavaScript, which we can't see, or the page may be mostly images."
    );
  }

  const { blog: blogLinks, resources: resourceLinks } = findCandidateLinks(html, finalUrl);

  let blogPage = null;
  if (blogLinks.length > 0) {
    try {
      const { html: blogHtml } = await fetchHtml(blogLinks[0].href);
      const blogExtract = extractCopy(blogHtml, { maxChars: 4000 });
      blogPage = {
        url: blogLinks[0].href,
        title: blogExtract.title,
        copy: blogExtract.copy,
      };
    } catch {
      blogPage = { url: blogLinks[0].href, fetchFailed: true };
    }
  }

  return { url: finalUrl, title, copy, blogLinks, resourceLinks, blogPage };
}
