export const SIGNAL_MAX = 5;
export const SIGNAL_COUNT = 5;
export const TOTAL_MAX = SIGNAL_MAX * SIGNAL_COUNT;

export function letterGrade(total, max = TOTAL_MAX) {
  const pct = total / max;
  if (pct >= 0.9) return "A";
  if (pct >= 0.75) return "B";
  if (pct >= 0.6) return "C";
  if (pct >= 0.4) return "D";
  return "F";
}

export function gradeTier(grade) {
  if (grade === "A" || grade === "B") return "good";
  if (grade === "C") return "mid";
  return "poor";
}
