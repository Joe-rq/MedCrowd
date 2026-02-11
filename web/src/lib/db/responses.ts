// Agent response operations with idempotency control

import type { DbAdapter } from "./types";
import { KV_KEYS, type AgentResponseRecord } from "./types";

export function createResponseOps(db: DbAdapter) {
  return {
    async addAgentResponse(response: AgentResponseRecord, round: number = 0): Promise<void> {
      const idempotentKey = KV_KEYS.idempotent(response.consultationId, round, response.responderId);
      const existingId = await db.get<string>(idempotentKey);
      if (existingId) return;

      const expectedRound = round === 0 ? "initial" : "reaction";
      const responses =
        (await db.get<AgentResponseRecord[]>(KV_KEYS.responses(response.consultationId))) || [];

      const alreadyExists = responses.some(
        (r) => r.responderId === response.responderId && r.round === expectedRound
      );
      if (alreadyExists) {
        await db.set(idempotentKey, response.id, { ex: 600 });
        return;
      }

      await db.set(idempotentKey, response.id, { ex: 600 });
      responses.push({ ...response, round: expectedRound });
      await db.set(KV_KEYS.responses(response.consultationId), responses);
    },

    async addAgentResponsesBatch(
      items: Array<{ response: AgentResponseRecord; round?: number }>
    ): Promise<Array<{ success: boolean; responseId: string; error?: string }>> {
      const results: Array<{ success: boolean; responseId: string; error?: string }> = [];

      for (const { response, round = 0 } of items) {
        try {
          const idempotentKey = KV_KEYS.idempotent(response.consultationId, round, response.responderId);
          const existingId = await db.get<string>(idempotentKey);

          if (existingId) {
            results.push({ success: true, responseId: response.id });
            continue;
          }

          const expectedRound = round === 0 ? "initial" : "reaction";
          const existing =
            (await db.get<AgentResponseRecord[]>(KV_KEYS.responses(response.consultationId))) || [];

          const alreadyExists = existing.some(
            (r) => r.responderId === response.responderId && r.round === expectedRound
          );

          if (!alreadyExists) {
            existing.push({ ...response, round: expectedRound });
            await db.set(KV_KEYS.responses(response.consultationId), existing);
          }

          await db.set(idempotentKey, response.id, { ex: 600 });
          results.push({ success: true, responseId: response.id });
        } catch (error) {
          results.push({
            success: false,
            responseId: response.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;
    },

    async getAgentResponses(consultationId: string): Promise<AgentResponseRecord[]> {
      const responses = await db.get<AgentResponseRecord[]>(KV_KEYS.responses(consultationId));
      return responses || [];
    },
  };
}
