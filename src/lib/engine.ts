// A2A consultation engine - orchestrates multi-agent queries

import { randomUUID } from "crypto";
import { chatWithAgent, refreshAccessToken } from "./secondme";
import {
  getConsultableUsers,
  circuitBreakUser,
  updateUserTokens,
  createConsultation,
  updateConsultation,
  addAgentResponse,
  getAgentResponses,
  type UserRecord,
  type AgentResponseRecord,
} from "./db";
import { validateResponse, isDuplicate } from "./validator";

const SYSTEM_PROMPT = `你是一个真实用户的 AI 代理。现在有人通过「MedCrowd（众医议）」平台向你咨询健康相关的经验。

请注意：
1. 你不是医生，不要给出诊断或处方
2. 基于你对主人的了解，分享相关的经验、看法或建议
3. 如果你的主人没有相关经历，请坦诚说明，可以分享一般性的看法
4. 回复控制在 200 字以内，简洁实用
5. 语气友善自然，像朋友之间聊天

对方的问题是：`;

const MAX_CONCURRENT = 5;
const AGENT_TIMEOUT_MS = 30_000;

export interface ConsultationResult {
  consultationId: string;
  status: "DONE" | "PARTIAL" | "FAILED";
  summary: ReportSummary | null;
  responses: AgentResponseRecord[];
}

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
}

// Query a single agent with timeout and error handling
async function queryAgent(
  user: UserRecord,
  question: string
): Promise<{ text: string; sessionId: string; latencyMs: number } | null> {
  const start = Date.now();

  // Check if token needs refresh
  if (user.tokenExpiry < Date.now() + 60_000) {
    try {
      const newTokens = await refreshAccessToken(user.refreshToken);
      updateUserTokens(user.id, newTokens.accessToken, newTokens.refreshToken, newTokens.expiresIn);
      user.accessToken = newTokens.accessToken;
    } catch {
      circuitBreakUser(user.id);
      return null;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    const result = await Promise.race([
      chatWithAgent(user.accessToken, question, SYSTEM_PROMPT + question),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), AGENT_TIMEOUT_MS)
      ),
    ]);

    clearTimeout(timeout);
    return { ...result, latencyMs: Date.now() - start };
  } catch (error) {
    const latencyMs = Date.now() - start;
    console.error(`Agent ${user.id} query failed (${latencyMs}ms):`, error);

    // If 401, try refresh once
    if (error instanceof Error && error.message.includes("401")) {
      circuitBreakUser(user.id);
    }

    return null;
  }
}

// Run full consultation
export async function runConsultation(
  askerId: string,
  question: string
): Promise<ConsultationResult> {
  const consultation = createConsultation(askerId, question);
  updateConsultation(consultation.id, { status: "CONSULTING" });

  const availableAgents = getConsultableUsers(askerId);
  const agentsToQuery = availableAgents.slice(0, MAX_CONCURRENT);

  updateConsultation(consultation.id, { agentCount: agentsToQuery.length });

  if (agentsToQuery.length === 0) {
    updateConsultation(consultation.id, { status: "FAILED" });
    return {
      consultationId: consultation.id,
      status: "FAILED",
      summary: null,
      responses: [],
    };
  }

  // Query all agents concurrently
  const results = await Promise.allSettled(
    agentsToQuery.map((agent) => queryAgent(agent, question))
  );

  const existingTexts: string[] = [];
  let validCount = 0;
  let noExperienceCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent = agentsToQuery[i];

    if (result.status === "rejected" || !result.value) {
      // Agent failed or timed out
      const response: AgentResponseRecord = {
        id: randomUUID(),
        consultationId: consultation.id,
        responderId: agent.id,
        sessionId: "",
        rawResponse: "",
        keyPoints: [],
        isValid: false,
        invalidReason: "请求失败或超时",
        latencyMs: AGENT_TIMEOUT_MS,
        createdAt: Date.now(),
      };
      addAgentResponse(response);
      continue;
    }

    const { text, sessionId, latencyMs } = result.value;
    const validation = validateResponse(text);
    const duplicate = isDuplicate(text, existingTexts);

    const isValid = validation.isValid && !duplicate;
    if (isValid) {
      existingTexts.push(text);
      if (validation.isNoExperience) {
        noExperienceCount++;
      } else {
        validCount++;
      }
    }

    const response: AgentResponseRecord = {
      id: randomUUID(),
      consultationId: consultation.id,
      responderId: agent.id,
      sessionId,
      rawResponse: text,
      keyPoints: [],
      isValid,
      invalidReason: !isValid
        ? duplicate
          ? "与其他回复重复"
          : validation.reason
        : undefined,
      latencyMs,
      createdAt: Date.now(),
    };
    addAgentResponse(response);
  }

  const allResponses = getAgentResponses(consultation.id);
  const validResponses = allResponses.filter((r) => r.isValid);

  // Generate summary
  let summary: ReportSummary | null = null;
  let status: "DONE" | "PARTIAL" | "FAILED";

  if (validCount >= 3) {
    summary = buildSummary(validResponses, agentsToQuery.length, noExperienceCount);
    status = "DONE";
  } else if (validCount > 0 || noExperienceCount > 0) {
    summary = buildSummary(validResponses, agentsToQuery.length, noExperienceCount);
    status = "PARTIAL";
  } else {
    status = "FAILED";
  }

  updateConsultation(consultation.id, {
    status: status === "PARTIAL" ? "DONE" : status,
    summary: summary as Record<string, unknown> | null,
  });

  return {
    consultationId: consultation.id,
    status,
    summary,
    responses: allResponses,
  };
}

// Build structured summary from valid responses
function buildSummary(
  responses: AgentResponseRecord[],
  totalQueried: number,
  noExperienceCount: number
): ReportSummary {
  // For the hackathon MVP, we extract key points from raw responses
  // and build a structured report
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

  return {
    consensus,
    divergence: [],
    preparation: extractPreparationItems(responses),
    needDoctorConfirm: ["具体诊断和治疗方案请咨询专业医生"],
    riskWarning:
      "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。健康问题请务必咨询专业医疗机构和医生。",
    agentResponses: agentResponsesSummary,
    noExperienceCount,
    totalAgentsQueried: totalQueried,
  };
}

// Simple key point extraction from response text
function extractKeyPoints(text: string): string[] {
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
  const checklist_markers = ["空腹", "带上", "携带", "提前", "注意", "记得", "准备", "不要吃", "停用"];

  for (const r of responses) {
    if (!r.isValid) continue;
    const sentences = r.rawResponse.split(/[。！？\n]+/);
    for (const s of sentences) {
      if (checklist_markers.some((m) => s.includes(m))) {
        const trimmed = s.trim();
        if (trimmed.length > 5 && trimmed.length < 100) {
          items.push(trimmed);
        }
      }
    }
  }

  // Dedup
  return [...new Set(items)].slice(0, 8);
}
