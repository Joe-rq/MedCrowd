// Main consultation orchestrator

import { randomUUID } from "crypto";
import {
  getConsultableUsers,
  getUserById,
  createConsultation,
  updateConsultation,
  addAgentResponsesBatch,
  getAgentResponses,
  pushEvent,
  type AgentResponseRecord,
} from "../db";
import { validateResponse, isDuplicate } from "../validator";
import { buildSummary, type ReportSummary } from "../summary";
import { triageHealthQuestion, getAdjustedSystemPrompt, type TriageResult } from "../act";
import { queryAgent } from "./agent-query";
import { runReactionRound } from "./reaction";
import { SYSTEM_PROMPT, MAX_CONCURRENT, AGENT_TIMEOUT_MS, REACTION_ROUND_ENABLED } from "./prompts";
import { ConsultationEmitter } from "./emitter";

export interface ConsultationResult {
  consultationId: string;
  status: "DONE" | "PARTIAL" | "FAILED";
  summary: ReportSummary | null;
  responses: AgentResponseRecord[];
  triage?: TriageResult;
}

export async function runConsultation(
  askerId: string,
  question: string,
  emitter?: ConsultationEmitter,
  existingConsultationId?: string
): Promise<ConsultationResult> {
  const em = emitter ?? new ConsultationEmitter();
  const askerUser = await getUserById(askerId);
  const askerAccessToken = askerUser?.accessToken ?? "";

  // Use pre-created consultation or create a new one
  const consultation = existingConsultationId
    ? { id: existingConsultationId }
    : await createConsultation(askerId, question);

  // Register KV event handler for SSE streaming
  const eventKey = `consultation-events:${consultation.id}`;
  em.on((event) => {
    pushEvent(eventKey, JSON.stringify(event), 300).catch(() => {});
  });

  await updateConsultation(consultation.id, { status: "CONSULTING" });
  em.emit({ type: "consultation:start", consultationId: consultation.id, question });

  // Step 1: Triage
  const triage = await triageHealthQuestion(question);
  const adjustedPrompt = getAdjustedSystemPrompt(SYSTEM_PROMPT + question, triage);

  const availableAgents = await getConsultableUsers(askerId);
  const agentsToQuery = availableAgents.slice(0, MAX_CONCURRENT);

  await updateConsultation(consultation.id, {
    agentCount: agentsToQuery.length,
    triage: triage as unknown as Record<string, unknown>,
  });

  if (agentsToQuery.length === 0) {
    await updateConsultation(consultation.id, { status: "FAILED" });
    em.emit({ type: "consultation:done", status: "FAILED" });
    return { consultationId: consultation.id, status: "FAILED", summary: null, responses: [], triage };
  }

  // Step 2: Parallel agent queries
  const { pendingResponses, validCount, noExperienceCount } =
    await queryAllAgents(consultation.id, agentsToQuery, question, adjustedPrompt, em);

  // Step 3: Batch persist
  const batchResults = await addAgentResponsesBatch(pendingResponses);
  const failedWrites = batchResults.filter((r) => !r.success);
  if (failedWrites.length > 0) {
    console.error(`[Engine] ${failedWrites.length} responses failed to persist`);
  }

  em.emit({ type: "validation:complete", validCount, totalCount: agentsToQuery.length });

  // Step 4: Reaction round (gated)
  const allResponses = await getAgentResponses(consultation.id);
  const validInitial = allResponses.filter((r) => r.isValid && r.round === "initial");

  if (REACTION_ROUND_ENABLED && validInitial.length >= 2 && validCount > 0) {
    await runReactionRound(consultation.id, question, validInitial, agentsToQuery, em);
  }

  // Step 5: Build report
  const finalResponses = await getAgentResponses(consultation.id);
  const validResponses = finalResponses.filter((r) => r.isValid);
  const reactionResponses = finalResponses.filter((r) => r.round === "reaction");

  let summary: ReportSummary | null = null;
  let status: "DONE" | "PARTIAL" | "FAILED";

  if (validCount >= 3) {
    summary = await buildSummary(validResponses, agentsToQuery.length, noExperienceCount, reactionResponses, question, askerAccessToken);
    status = failedWrites.length > 0 ? "PARTIAL" : "DONE";
  } else if (validCount > 0 || noExperienceCount > 0) {
    summary = await buildSummary(validResponses, agentsToQuery.length, noExperienceCount, reactionResponses, question, askerAccessToken);
    status = "PARTIAL";
  } else if (finalResponses.length < agentsToQuery.length) {
    status = "PARTIAL";
  } else {
    status = "FAILED";
  }

  if (summary) em.emit({ type: "summary:ready", report: summary });

  await updateConsultation(consultation.id, {
    status,
    summary: summary as Record<string, unknown> | null,
  });

  em.emit({ type: "consultation:done", status });
  return { consultationId: consultation.id, status, summary, responses: finalResponses, triage };
}

async function queryAllAgents(
  consultationId: string,
  agents: Awaited<ReturnType<typeof getConsultableUsers>>,
  question: string,
  systemPrompt: string,
  emitter: ConsultationEmitter
) {
  for (const agent of agents) {
    emitter.emit({ type: "agent:query_start", agentId: agent.id, round: "initial" });
  }

  const results = await Promise.allSettled(
    agents.map((agent) => queryAgent(agent, question, systemPrompt))
  );

  const existingTexts: string[] = [];
  let validCount = 0;
  let noExperienceCount = 0;
  const pendingResponses: Array<{ response: AgentResponseRecord; round: number }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent = agents[i];

    if (result.status === "rejected" || !result.value) {
      emitter.emit({ type: "agent:error", agentId: agent.id, error: "Request failed or timeout" });
      pendingResponses.push({
        response: {
          id: randomUUID(), consultationId, responderId: agent.id, sessionId: "",
          rawResponse: "", keyPoints: [], isValid: false,
          invalidReason: "请求失败或超时", latencyMs: AGENT_TIMEOUT_MS,
          createdAt: Date.now(), round: "initial",
        },
        round: 0,
      });
      continue;
    }

    const { text, sessionId, latencyMs } = result.value;
    const validation = validateResponse(text);
    const duplicate = isDuplicate(text, existingTexts);
    const isValid = validation.isValid && !duplicate;

    if (isValid) {
      existingTexts.push(text);
      if (validation.isNoExperience) noExperienceCount++;
      else validCount++;
    }

    emitter.emit({ type: "agent:response", agentId: agent.id, round: "initial", latencyMs });

    pendingResponses.push({
      response: {
        id: randomUUID(), consultationId, responderId: agent.id, sessionId,
        rawResponse: text, keyPoints: [], isValid,
        invalidReason: !isValid ? (duplicate ? "与其他回复重复" : validation.reason) : undefined,
        latencyMs, createdAt: Date.now(), round: "initial",
      },
      round: 0,
    });
  }

  return { pendingResponses, validCount, noExperienceCount };
}
