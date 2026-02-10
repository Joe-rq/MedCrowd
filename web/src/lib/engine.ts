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
import { buildSummary, type ReportSummary } from "./summary";
import { triageHealthQuestion, getAdjustedSystemPrompt, type TriageResult } from "./act";

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
  triage?: TriageResult;
}

export type { ReportSummary } from "./summary";

// Query a single agent with timeout and error handling
async function queryAgent(
  user: UserRecord,
  question: string,
  systemPrompt: string
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
      chatWithAgent(user.accessToken, question, systemPrompt),
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

  // Step 1: Perform intent triage before consultation
  const triage = await triageHealthQuestion(question);
  console.log(`[Triage] Intent: ${triage.intent}, Confidence: ${triage.confidence}`);

  // Adjust system prompt based on triage
  const adjustedPrompt = getAdjustedSystemPrompt(SYSTEM_PROMPT + question, triage);

  const availableAgents = getConsultableUsers(askerId);
  const agentsToQuery = availableAgents.slice(0, MAX_CONCURRENT);

  updateConsultation(consultation.id, {
    agentCount: agentsToQuery.length,
    triage: triage as unknown as Record<string, unknown>,
  });

  if (agentsToQuery.length === 0) {
    updateConsultation(consultation.id, { status: "FAILED" });
    return {
      consultationId: consultation.id,
      status: "FAILED",
      summary: null,
      responses: [],
      triage,
    };
  }

  // Query all agents concurrently with adjusted prompt
  const results = await Promise.allSettled(
    agentsToQuery.map((agent) => queryAgent(agent, question, adjustedPrompt))
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
    triage,
  };
}
