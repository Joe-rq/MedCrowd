// Summary pipeline - compose extractors into a report

import type { AgentResponseRecord, ReportSummary } from "./types";
import { extractKeyPoints } from "./extractors/key-points";
import { extractConsensus } from "./extractors/consensus";
import { extractDivergence } from "./extractors/divergence";
import { extractPreparation } from "./extractors/preparation";
import { extractDoctorConfirm } from "./extractors/doctor";
import { extractCostRange } from "./extractors/cost";

export function buildSummary(
  responses: AgentResponseRecord[],
  totalQueried: number,
  noExperienceCount: number,
  reactionResponses?: AgentResponseRecord[]
): ReportSummary {
  const validResponses = responses.filter((r) => r.isValid);

  const agentResponses = validResponses.map((r) => ({
    agentId: "匿名",
    summary: r.rawResponse.slice(0, 200),
    keyPoints: extractKeyPoints(r.rawResponse),
  }));

  const reactionHighlights = reactionResponses
    ?.filter((r) => r.isValid && r.rawResponse.length > 10)
    .map((r) => ({
      agentId: `Agent ${r.responderId.slice(0, 8)}`,
      reaction: r.rawResponse.slice(0, 150),
      references: extractKeyPoints(r.rawResponse).slice(0, 2),
    }));

  return {
    consensus: extractConsensus(responses),
    divergence: extractDivergence(responses),
    preparation: extractPreparation(responses),
    needDoctorConfirm: extractDoctorConfirm(responses),
    costRange: extractCostRange(responses),
    riskWarning:
      "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。健康问题请务必咨询专业医疗机构和医生。",
    agentResponses,
    noExperienceCount,
    totalAgentsQueried: totalQueried,
    reactionHighlights,
  };
}
