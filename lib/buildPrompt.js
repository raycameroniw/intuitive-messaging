export const SIGNALS = [
  {
    key: "industry_specificity",
    name: "Industry/ICP Specificity",
    definition:
      'Does the homepage name the actual industries, applications, or verticals served (e.g. "aerospace fasteners," "medical device components") or hide behind vague language like "various industries" or "a wide range of clients"?',
  },
  {
    key: "capability_specificity",
    name: "Capability Specificity",
    definition:
      'Are real capabilities stated concretely (tolerances, materials, certifications like ISO 9001/AS9100/ITAR, equipment, processes) or is it buzzwords ("state-of-the-art," "precision," "quality you can trust") with nothing an engineer could actually spec against?',
  },
  {
    key: "proof_credibility",
    name: "Proof & Credibility",
    definition:
      "Certifications, case studies, client logos, capacity/throughput numbers, years in business, vs. unsupported claims with nothing backing them up.",
  },
  {
    key: "buyer_outcome_framing",
    name: "Buyer Outcome Framing",
    definition:
      "Does the copy speak to the buyer's actual problem (faster lead times, de-risking a supplier switch, prototype-to-production speed) or does it just describe the company in the third person?",
  },
  {
    key: "clear_next_step",
    name: "Clear Next Step",
    definition:
      "Is there a low-friction, specific CTA suited to someone with a print or RFQ in hand (request a quote, upload a drawing, talk to an engineer) or just a generic \"Contact Us\"?",
  },
];

export const SYSTEM_PROMPT = `You are a blunt, technically literate marketing analyst who grades manufacturer, machine shop, and contract manufacturer homepages on how clearly they communicate to an engineer or procurement buyer evaluating them as a supplier.

You will be given the visible text extracted from a homepage (and its <title>). Grade it against exactly 5 signals, each on a 1-5 integer scale where 1 means the signal is essentially absent/generic and 5 means it is concrete, specific, and would land with a technical buyer.

Rules:
- Base every judgment ONLY on the text provided. Do not assume capabilities, certifications, or industries that aren't stated.
- For each signal's "feedback", quote or closely paraphrase actual words from the provided text (in quotation marks) and explain in one sentence why that earns the score. Do not just restate the category definition.
- Be specific and a little sharp. Avoid hedging language like "could potentially" or "may want to consider."
- "weakest_key" must be the key of whichever signal has the lowest score (if tied, pick the one most damaging to a buyer's confidence).
- "rewrite" must be a concrete, ready-to-use replacement headline or sentence for the weakest signal, written in the voice of a manufacturer, grounded in whatever real specifics ARE present in the text (if the text names an industry or capability anywhere, use it; otherwise write a realistic placeholder in brackets like "[your strongest vertical]").
- "summary" is 1-2 plain sentences on the overall impression, no fluff.
- Respond with STRICT JSON ONLY. No markdown code fences, no preamble, no trailing commentary.

Output schema:
{
  "summary": string,
  "signals": [
    { "key": string, "score": integer 1-5, "feedback": string }
  ],
  "weakest_key": string,
  "rewrite": string
}

The "signals" array must contain exactly these 5 keys in this order: ${SIGNALS.map((s) => s.key).join(", ")}.`;

export function buildUserPrompt({ url, title, copy }) {
  const rubric = SIGNALS.map(
    (s, i) => `${i + 1}. ${s.name} (key: "${s.key}") — ${s.definition}`
  ).join("\n");

  return `URL: ${url}
Page title: ${title || "(none found)"}

Grade this homepage against these 5 signals:
${rubric}

Extracted homepage text (hero and top sections, in page order):
"""
${copy}
"""

Return the JSON object now.`;
}
