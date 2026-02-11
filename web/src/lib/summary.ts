// Report summary building - extracted from engine.ts

import type { AgentResponseRecord } from "./db";

export interface ReportSummary {
  consensus: { point: string; agentCount: number; totalAgents: number }[];
  divergence: { pointA: string; pointB: string; splitRatio: string }[];
  preparation: string[];
  needDoctorConfirm: string[];
  costRange?: { min: number; max: number; note: string };
  riskWarning: string;
  agentResponses: { agentId: string; summary: string; keyPoints: string[] }[];
  noExperienceCount: number;
  totalAgentsQueried: number;
  reactionHighlights?: { agentId: string; reaction: string; references: string[] }[];
}

export function buildSummary(
  responses: AgentResponseRecord[],
  totalQueried: number,
  noExperienceCount: number,
  reactionResponses?: AgentResponseRecord[]
): ReportSummary {
  const substantiveResponses = responses.filter(
    (r) => r.isValid && !r.invalidReason?.includes("无相关经历")
  );

  const agentResponsesSummary = responses
    .filter((r) => r.isValid)
    .map((r) => ({
      agentId: "匿名",
      summary: r.rawResponse.slice(0, 200),
      keyPoints: extractKeyPoints(r.rawResponse),
    }));

  // Extract common themes
  const allKeyPoints = agentResponsesSummary.flatMap((r) => r.keyPoints);
  const pointCounts = new Map<string, number>();
  for (const point of allKeyPoints) {
    const key = point.slice(0, 20); // Rough grouping
    pointCounts.set(key, (pointCounts.get(key) || 0) + 1);
  }

  const consensus = allKeyPoints
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
        substantiveResponses.length
      ),
      totalAgents: substantiveResponses.length,
    }));

  const costRange = extractCostRange(responses);

  const reactionHighlights = reactionResponses
    ?.filter((r) => r.isValid && r.rawResponse.length > 10)
    .map((r) => ({
      agentId: `Agent ${r.responderId.slice(0, 8)}`,
      reaction: r.rawResponse.slice(0, 150),
      references: extractKeyPoints(r.rawResponse).slice(0, 2),
    }));

  return {
    consensus,
    divergence: extractDivergence(responses),
    preparation: extractPreparationItems(responses),
    needDoctorConfirm: extractDoctorConfirmItems(responses),
    costRange,
    riskWarning:
      "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。健康问题请务必咨询专业医疗机构和医生。",
    agentResponses: agentResponsesSummary,
    noExperienceCount,
    totalAgentsQueried: totalQueried,
    reactionHighlights,
  };
}

// Extract cost range from responses (e.g., "几百块", "1000-2000元")
function extractCostRange(responses: AgentResponseRecord[]): { min: number; max: number; note: string } | undefined {
  const costPatterns = [
    /(\d+)\s*-\s*(\d+)\s*元/,
    /(\d+)\s*元/,
    /大约\s*(\d+)\s*元/,
    /几千?块?/,
    /几百?块?/,
  ];

  const costs: number[] = [];

  for (const r of responses) {
    if (!r.isValid) continue;
    const text = r.rawResponse;

    for (const pattern of costPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          costs.push(parseInt(match[1]));
          costs.push(parseInt(match[2]));
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

  // Cap unrealistic values (health consultation typically < 100000)
  if (max > 100000) return undefined;

  let note = "";
  if (min < 100 && max < 100) {
    note = "常规检查费用";
  } else if (max < 1000) {
    note = "门诊/检查费用";
  } else if (max < 10000) {
    note = "治疗费用范围";
  } else {
    note = "综合费用参考";
  }

  return { min, max, note };
}

// Simple key point extraction from response text
export function extractKeyPoints(text: string): string[] {
  const points: string[] = [];
  const sentences = text.split(/[。！？\n]+/).filter((s) => s.trim().length > 5);

  for (const sentence of sentences.slice(0, 3)) {
    points.push(sentence.trim());
  }

  return points;
}

// Extract preparation/checklist items
function extractPreparationItems(responses: AgentResponseRecord[]): string[] {
  const items: string[] = [];
  const markers = [
    "空腹", "带上", "携带", "提前", "注意", "记得", "准备", "不要吃", "停用",
  ];

  for (const r of responses) {
    if (!r.isValid) continue;
    const sentences = r.rawResponse.split(/[。！？\n]+/);
    for (const s of sentences) {
      if (markers.some((m) => s.includes(m))) {
        const trimmed = s.trim();
        if (trimmed.length > 5 && trimmed.length < 100) {
          items.push(trimmed);
        }
      }
    }
  }

  return [...new Set(items)].slice(0, 8);
}

// Extract divergence (opposing viewpoints) from responses
function extractDivergence(
  responses: AgentResponseRecord[]
): { pointA: string; pointB: string; splitRatio: string }[] {
  const validResponses = responses.filter((r) => r.isValid);
  if (validResponses.length < 2) return [];

  // Define opposing keyword pairs
  const opposingPairs = [
    ['建议', '不建议'],
    ['可以', '不要'],
    ['需要', '不需要'],
    ['应该', '不应该'],
    ['先', '直接'],
    ['要', '别'],
    ['做', '不做'],
    ['去', '不去'],
    ['吃', '不吃'],
    ['用', '不用'],
  ];

  const divergences: { pointA: string; pointB: string; splitRatio: string }[] = [];

  // Check each opposing pair
  for (const [positive, negative] of opposingPairs) {
    const positiveResponses: string[] = [];
    const negativeResponses: string[] = [];

    for (const r of validResponses) {
      const sentences = r.rawResponse.split(/[。！？\n]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 5 || trimmed.length > 100) continue;

        if (trimmed.includes(positive) && !trimmed.includes(negative)) {
          positiveResponses.push(trimmed);
        } else if (trimmed.includes(negative)) {
          negativeResponses.push(trimmed);
        }
      }
    }

    // If we found opposing viewpoints, record the divergence
    if (positiveResponses.length > 0 && negativeResponses.length > 0) {
      const total = positiveResponses.length + negativeResponses.length;
      const ratio = `${positiveResponses.length}:${negativeResponses.length}`;

      divergences.push({
        pointA: positiveResponses[0],
        pointB: negativeResponses[0],
        splitRatio: ratio,
      });
    }
  }

  return divergences.slice(0, 3); // Return top 3 divergences
}

// Extract items that need doctor confirmation from responses
function extractDoctorConfirmItems(responses: AgentResponseRecord[]): string[] {
  const keywords = [
    '问医生', '咨询医生', '医生确认', '遵医嘱',
    '复查', '进一步检查', '确诊', '医生建议',
    '就医', '看医生', '去医院', '专业医生',
    '医疗机构', '诊断', '治疗方案',
  ];

  const items: string[] = [];

  for (const r of responses) {
    if (!r.isValid) continue;
    const sentences = r.rawResponse.split(/[。！？\n]+/);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 5 || trimmed.length > 150) continue;

      // Check if sentence contains any of the keywords
      if (keywords.some((keyword) => trimmed.includes(keyword))) {
        items.push(trimmed);
      }
    }
  }

  // Remove duplicates and limit to 5 items
  const uniqueItems = [...new Set(items)].slice(0, 5);

  // If no items found, return default message
  if (uniqueItems.length === 0) {
    return ["具体诊断和治疗方案请咨询专业医生"];
  }

  return uniqueItems;
}
