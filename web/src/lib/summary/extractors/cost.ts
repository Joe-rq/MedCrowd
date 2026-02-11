// Extract cost range from responses

import type { AgentResponseRecord } from "../types";

const COST_PATTERNS = [
  /(\d+)\s*-\s*(\d+)\s*元/,
  /(\d+)\s*元/,
  /大约\s*(\d+)\s*元/,
  /几千?块?/,
  /几百?块?/,
];

export function extractCostRange(
  responses: AgentResponseRecord[]
): { min: number; max: number; note: string } | undefined {
  const costs: number[] = [];

  for (const r of responses) {
    if (!r.isValid) continue;
    for (const pattern of COST_PATTERNS) {
      const match = r.rawResponse.match(pattern);
      if (match) {
        if (match[2]) {
          costs.push(parseInt(match[1]), parseInt(match[2]));
        } else if (match[1]) {
          costs.push(parseInt(match[1]));
        }
        break;
      }
    }
  }

  if (costs.length === 0) return undefined;

  const min = Math.min(...costs);
  const max = Math.max(...costs);

  if (max > 100000) return undefined;

  let note = "";
  if (min < 100 && max < 100) note = "常规检查费用";
  else if (max < 1000) note = "门诊/检查费用";
  else if (max < 10000) note = "治疗费用范围";
  else note = "综合费用参考";

  return { min, max, note };
}
