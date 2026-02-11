// Reaction round - agents respond to each other's initial answers

import { randomUUID } from "crypto";
import type { UserRecord, AgentResponseRecord } from "../db";
import { addAgentResponsesBatch } from "../db";
import { queryAgent } from "./agent-query";
import { REACTION_PROMPT, AGENT_TIMEOUT_MS } from "./prompts";
import type { ConsultationEmitter } from "./emitter";

export async function runReactionRound(
  consultationId: string,
  question: string,
  validInitialResponses: AgentResponseRecord[],
  agentsToQuery: UserRecord[],
  emitter: ConsultationEmitter
): Promise<void> {
  emitter.emit({ type: "reaction:start", triggerCount: validInitialResponses.length });

  const summaryText = validInitialResponses
    .map((r, i) => `${i + 1}. Agent ${r.responderId.slice(0, 8)}: ${r.rawResponse.slice(0, 100)}...`)
    .join("\n");

  const reactionPrompt = REACTION_PROMPT + summaryText + "\n\n" + question;

  const reactionTargets = agentsToQuery.filter((agent) =>
    validInitialResponses.some((r) => r.responderId === agent.id)
  );

  const results = await Promise.allSettled(
    reactionTargets.map((agent) => {
      emitter.emit({ type: "agent:query_start", agentId: agent.id, round: "reaction" });
      return queryAgent(agent, question, reactionPrompt);
    })
  );

  const pending: Array<{ response: AgentResponseRecord; round: number }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent = reactionTargets[i];
    const succeeded = result.status === "fulfilled" && !!result.value;

    const response: AgentResponseRecord = {
      id: randomUUID(),
      consultationId,
      responderId: agent.id,
      sessionId: succeeded ? result.value!.sessionId : "",
      rawResponse: succeeded ? result.value!.text : "Reaction round failed",
      keyPoints: [],
      isValid: succeeded,
      invalidReason: succeeded ? undefined : "Reaction round timeout or failed",
      latencyMs: succeeded ? result.value!.latencyMs : AGENT_TIMEOUT_MS,
      createdAt: Date.now(),
      round: "reaction",
    };
    pending.push({ response, round: 1 });

    if (succeeded) {
      emitter.emit({ type: "agent:response", agentId: agent.id, round: "reaction", latencyMs: result.value!.latencyMs });
    } else {
      emitter.emit({ type: "agent:error", agentId: agent.id, error: "Reaction failed" });
    }
  }

  const batchResults = await addAgentResponsesBatch(pending);
  const failed = batchResults.filter((r) => !r.success);
  if (failed.length > 0) {
    console.error(`[Engine] ${failed.length} reaction responses failed to persist`);
  }

  emitter.emit({ type: "reaction:complete", responseCount: pending.length });
}
