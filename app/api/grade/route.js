import Anthropic from "@anthropic-ai/sdk";
import { fetchAndExtract, ExtractError } from "../../../lib/extractContent";
import { SIGNALS, SYSTEM_PROMPT, buildUserPrompt } from "../../../lib/buildPrompt";
import { TOTAL_MAX, letterGrade } from "../../../lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function jsonError(status, message) {
  return Response.json({ error: message }, { status });
}

function extractErrorStatus(code) {
  switch (code) {
    case "INVALID_URL":
      return 400;
    case "TIMEOUT":
      return 504;
    case "NETWORK_ERROR":
      return 502;
    case "HTTP_ERROR":
      return 502;
    case "NOT_HTML":
      return 415;
    case "THIN_CONTENT":
      return 422;
    default:
      return 500;
  }
}

function stripJsonFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function isValidGrading(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  if (typeof parsed.summary !== "string") return false;
  if (!Array.isArray(parsed.signals) || parsed.signals.length !== SIGNALS.length)
    return false;
  const keys = new Set(SIGNALS.map((s) => s.key));
  for (const s of parsed.signals) {
    if (!keys.has(s.key)) return false;
    if (!Number.isInteger(s.score) || s.score < 1 || s.score > 5) return false;
    if (typeof s.feedback !== "string" || !s.feedback.trim()) return false;
  }
  if (typeof parsed.weakest_key !== "string" || !keys.has(parsed.weakest_key))
    return false;
  if (typeof parsed.rewrite !== "string" || !parsed.rewrite.trim()) return false;
  return true;
}

async function callClaude(userPrompt) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = msg.content.find((b) => b.type === "text")?.text || "";
  return JSON.parse(stripJsonFences(text));
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return jsonError(500, "The grading service isn't configured yet.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Malformed request.");
  }

  let extracted;
  try {
    extracted = await fetchAndExtract(body?.url);
  } catch (err) {
    if (err instanceof ExtractError) {
      return jsonError(extractErrorStatus(err.code), err.message);
    }
    console.error("Unexpected extraction error", err);
    return jsonError(500, "Something went wrong reading that page.");
  }

  const userPrompt = buildUserPrompt(extracted);

  let parsed;
  try {
    parsed = await callClaude(userPrompt);
    if (!isValidGrading(parsed)) throw new Error("Malformed grading shape");
  } catch (err) {
    try {
      parsed = await callClaude(
        userPrompt +
          "\n\nYour previous response was not valid JSON matching the schema. Return ONLY the JSON object, matching the schema exactly."
      );
      if (!isValidGrading(parsed)) throw new Error("Malformed grading shape (retry)");
    } catch (retryErr) {
      console.error("Grading failed", err, retryErr);
      return jsonError(
        502,
        "The grading service returned an unexpected response. Please try again."
      );
    }
  }

  const scoreByKey = Object.fromEntries(parsed.signals.map((s) => [s.key, s]));
  const total = parsed.signals.reduce((sum, s) => sum + s.score, 0);
  const grade = letterGrade(total, TOTAL_MAX);

  const trueWeakest = SIGNALS.reduce((min, s) =>
    scoreByKey[s.key].score < scoreByKey[min.key].score ? s : min
  , SIGNALS[0]);

  const signals = SIGNALS.map((s) => ({
    key: s.key,
    name: s.name,
    score: scoreByKey[s.key].score,
    max: 5,
    feedback: scoreByKey[s.key].feedback,
  }));

  return Response.json({
    url: extracted.url,
    title: extracted.title,
    totalScore: total,
    maxScore: TOTAL_MAX,
    grade,
    summary: parsed.summary,
    signals,
    weakestSignalName: trueWeakest.name,
    rewrite: parsed.rewrite,
    blogFound: Boolean(extracted.blogLinks?.length),
    resourcesFound: Boolean(extracted.resourceLinks?.length),
  });
}
