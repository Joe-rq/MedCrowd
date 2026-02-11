// Extract divergence (opposing viewpoints) from responses

import type { AgentResponseRecord } from "../types";

const OPPOSING_PAIRS = [
  ["建议", "不建议"], ["可以", "不要"], ["需要", "不需要"],
  ["应该", "不应该"], ["先", "直接"], ["要", "别"],
  ["做", "不做"], ["去", "不去"], ["吃", "不吃"], ["用", "不用"],
];

export function extractDivergence(
  responses: AgentResponseRecord[]
): { pointA: string; pointB: string; splitRatio: string }[] {
  const valid = responses.filter((r) => r.isValid);
  if (valid.length < 2) return [];

  const divergences: { pointA: string; pointB: string; splitRatio: string }[] = [];

  for (const [positive, negative] of OPPOSING_PAIRS) {
    const positiveHits: string[] = [];
    const negativeHits: string[] = [];

    for (const r of valid) {
      const sentences = r.rawResponse.split(/[。！？\n]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 5 || trimmed.length > 100) continue;

        if (trimmed.includes(positive) && !trimmed.includes(negative)) {
          positiveHits.push(trimmed);
        } else if (trimmed.includes(negative)) {
          negativeHits.push(trimmed);
        }
      }
    }

    if (positiveHits.length > 0 && negativeHits.length > 0) {
      divergences.push({
        pointA: positiveHits[0],
        pointB: negativeHits[0],
        splitRatio: `${positiveHits.length}:${negativeHits.length}`,
      });
    }
  }

  return divergences.slice(0, 3);
}
