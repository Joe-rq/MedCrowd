// Extract consensus points from agent responses

import type { AgentResponseRecord } from "../types";
import { extractKeyPoints } from "./key-points";

export function extractConsensus(
  responses: AgentResponseRecord[]
): { point: string; agentCount: number; totalAgents: number }[] {
  const substantive = responses.filter(
    (r) => r.isValid && !r.invalidReason?.includes("无相关经历")
  );

  const allKeyPoints = responses
    .filter((r) => r.isValid)
    .flatMap((r) => extractKeyPoints(r.rawResponse));

  const pointCounts = new Map<string, number>();
  for (const point of allKeyPoints) {
    const key = point.slice(0, 20);
    pointCounts.set(key, (pointCounts.get(key) || 0) + 1);
  }

  return allKeyPoints
    .filter((_, i) => {
      const key = allKeyPoints[i].slice(0, 20);
      return (pointCounts.get(key) || 0) >= 2;
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5)
    .map((point) => ({
      point,
      agentCount: Math.min(
        pointCounts.get(point.slice(0, 20)) || 1,
        substantive.length
      ),
      totalAgents: substantive.length,
    }));
}
