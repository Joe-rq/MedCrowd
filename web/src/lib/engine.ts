// A2A consultation engine - orchestrates multi-agent queries

import { randomUUID } from "crypto";
import { chatWithAgent, refreshAccessToken } from "./secondme";
import {
  getConsultableUsers,
  circuitBreakUser,
  updateUserTokens,
  createConsultation,
  updateConsultation,
  addAgentResponsesBatch,
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

const REACTION_PROMPT = `其他用户的 AI 代理已经分享了他们的看法。作为第二轮讨论，请：
1. 如果其他观点与你主人的经验有共鸣或冲突，请补充说明
2. 如果某个观点让你主人想追问细节，请明确提出
3. 保持友善，像圆桌讨论一样交流

其他代理的看法摘要：

对方原始问题：`;

const MAX_CONCURRENT = 5;
const AGENT_TIMEOUT_MS = 30_000;
const REACTION_ROUND_ENABLED = process.env.REACTION_ROUND_ENABLED === "true";

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
      await updateUserTokens(user.id, newTokens.accessToken, newTokens.refreshToken, newTokens.expiresIn);
      user.accessToken = newTokens.accessToken;
    } catch {
      await circuitBreakUser(user.id);
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
      await circuitBreakUser(user.id);
    }

    return null;
  }
}

// Run full consultation
export async function runConsultation(
  askerId: string,
  question: string
): Promise<ConsultationResult> {
  const consultation = await createConsultation(askerId, question);
  await updateConsultation(consultation.id, { status: "CONSULTING" });

  // Step 1: Perform intent triage before consultation
  const triage = await triageHealthQuestion(question);
  console.log(`[Triage] Intent: ${triage.intent}, Confidence: ${triage.confidence}`);

  // Adjust system prompt based on triage
  const adjustedPrompt = getAdjustedSystemPrompt(SYSTEM_PROMPT + question, triage);

  const availableAgents = await getConsultableUsers(askerId);
  const agentsToQuery = availableAgents.slice(0, MAX_CONCURRENT);

  await updateConsultation(consultation.id, {
    agentCount: agentsToQuery.length,
    triage: triage as unknown as Record<string, unknown>,
  });

  if (agentsToQuery.length === 0) {
    await updateConsultation(consultation.id, { status: "FAILED" });
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

  // 阶段1：收集所有响应对象（不立即写入）
  const pendingResponses: Array<{ response: AgentResponseRecord; round: number }> = [];

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
        round: "initial",
      };
      pendingResponses.push({ response, round: 0 });
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
      round: "initial",
    };
    pendingResponses.push({ response, round: 0 });
  }

  // 阶段2：批量写入，失败隔离
  const batchResults = await addAgentResponsesBatch(pendingResponses);
  const failedWrites = batchResults.filter((r) => !r.success);
  if (failedWrites.length > 0) {
    console.error(`[Engine] ${failedWrites.length} responses failed to persist:`,
      failedWrites.map((f) => ({ id: f.responseId, error: f.error }))
    );
  }

  // 阶段3：Reaction Round（门控条件：有效响应 >=2 且开启开关）
  const allResponses = await getAgentResponses(consultation.id);
  const validInitialResponses = allResponses.filter(
    (r) => r.isValid && r.round === "initial"
  );

  const shouldRunReactionRound =
    REACTION_ROUND_ENABLED &&
    validInitialResponses.length >= 2 &&
    validCount > 0;

  if (shouldRunReactionRound) {
    const summaryText = validInitialResponses
      .map(
        (r, i) =>
          `${i + 1}. Agent ${r.responderId.slice(0, 8)}: ${r.rawResponse.slice(0, 100)}...`
      )
      .join("\n");

    const reactionPrompt = REACTION_PROMPT + summaryText + "\n\n" + question;

    const reactionTargets = agentsToQuery.filter((agent) =>
      validInitialResponses.some((r) => r.responderId === agent.id)
    );

    const reactionResults = await Promise.allSettled(
      reactionTargets.map((agent) =>
        queryAgent(agent, question, reactionPrompt)
      )
    );

    const pendingReactions: Array<{ response: AgentResponseRecord; round: number }> =
      [];

    for (let i = 0; i < reactionResults.length; i++) {
      const result = reactionResults[i];
      const agent = reactionTargets[i];

      const response: AgentResponseRecord = {
        id: randomUUID(),
        consultationId: consultation.id,
        responderId: agent.id,
        sessionId: result.status === "fulfilled" && result.value ? result.value.sessionId : "",
        rawResponse:
          result.status === "fulfilled" && result.value
            ? result.value.text
            : "Reaction round failed",
        keyPoints: [],
        isValid: result.status === "fulfilled" && !!result.value,
        invalidReason:
          result.status !== "fulfilled" || !result.value
            ? "Reaction round timeout or failed"
            : undefined,
        latencyMs:
          result.status === "fulfilled" && result.value
            ? result.value.latencyMs
            : AGENT_TIMEOUT_MS,
        createdAt: Date.now(),
        round: "reaction",
      };
      pendingReactions.push({ response, round: 1 });
    }

    const reactionBatchResults = await addAgentResponsesBatch(pendingReactions);
    const failedReactionWrites = reactionBatchResults.filter((r) => !r.success);
    if (failedReactionWrites.length > 0) {
      console.error(
        `[Engine] ${failedReactionWrites.length} reaction responses failed to persist`,
        failedReactionWrites.map((f) => ({ id: f.responseId, error: f.error }))
      );
    }
  }

  // 获取最终所有响应
  const finalResponses = await getAgentResponses(consultation.id);
  const validResponses = finalResponses.filter((r) => r.isValid);

  // Generate summary
  let summary: ReportSummary | null = null;
  let status: "DONE" | "PARTIAL" | "FAILED";

  // 计算实际可用来生成报告的响应数（考虑写入失败的情况）
  const persistedCount = finalResponses.length;
  const expectedCount = agentsToQuery.length;

  if (validCount >= 3) {
    summary = buildSummary(
      validResponses,
      agentsToQuery.length,
      noExperienceCount,
      finalResponses.filter((r) => r.round === "reaction")
    );
    // 如果有写入失败，降级为 PARTIAL
    status = failedWrites.length > 0 ? "PARTIAL" : "DONE";
  } else if (validCount > 0 || noExperienceCount > 0) {
    summary = buildSummary(
      validResponses,
      agentsToQuery.length,
      noExperienceCount,
      finalResponses.filter((r) => r.round === "reaction")
    );
    status = "PARTIAL";
  } else if (persistedCount < expectedCount) {
    // 有响应但写入失败导致无法评估
    status = "PARTIAL";
  } else {
    status = "FAILED";
  }

  // 数据库存储状态：PARTIAL 也存为 DONE（因为 DB schema 只有 DONE/FAILED）
  // 但引擎返回的 status 保持 PARTIAL 以便前端展示降级状态
  await updateConsultation(consultation.id, {
    status: status === "FAILED" ? "FAILED" : "DONE",
    summary: summary as Record<string, unknown> | null,
  });

  return {
    consultationId: consultation.id,
    status,
    summary,
    responses: finalResponses,
    triage,
  };
}
