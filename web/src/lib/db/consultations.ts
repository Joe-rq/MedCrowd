// Consultation CRUD operations

import { randomUUID } from "crypto";
import type { DbAdapter } from "./types";
import { KV_KEYS, type ConsultationRecord } from "./types";

export function createConsultationOps(db: DbAdapter) {
  return {
    async createConsultation(askerId: string, question: string): Promise<ConsultationRecord> {
      const consultation: ConsultationRecord = {
        id: randomUUID(),
        askerId,
        question,
        status: "PENDING",
        agentCount: 0,
        summary: null,
        triage: null,
        createdAt: Date.now(),
      };

      await db.set(KV_KEYS.consultation(consultation.id), consultation);
      await db.set(KV_KEYS.responses(consultation.id), []);
      await db.lpush(KV_KEYS.userConsultations(askerId), consultation.id);
      return consultation;
    },

    async getConsultation(id: string): Promise<ConsultationRecord | undefined> {
      const c = await db.get<ConsultationRecord>(KV_KEYS.consultation(id));
      return c || undefined;
    },

    async updateConsultation(
      id: string,
      updates: Partial<Pick<ConsultationRecord, "status" | "agentCount" | "summary" | "triage">>
    ): Promise<void> {
      const c = await db.get<ConsultationRecord>(KV_KEYS.consultation(id));
      if (c) {
        Object.assign(c, updates);
        await db.set(KV_KEYS.consultation(id), c);
      }
    },

    async getUserConsultations(userId: string): Promise<ConsultationRecord[]> {
      const ids = await db.lrange(KV_KEYS.userConsultations(userId), 0, -1);
      if (!ids || ids.length === 0) return [];

      const consultations: ConsultationRecord[] = [];
      for (const id of ids) {
        const c = await db.get<ConsultationRecord>(KV_KEYS.consultation(id));
        if (c) consultations.push(c);
      }
      return consultations.sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}
