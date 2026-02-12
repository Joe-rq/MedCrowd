// Feedback CRUD operations

import { randomUUID } from "crypto";
import type { DbAdapter } from "./types";
import { KV_KEYS, type FeedbackRecord } from "./types";

export function createFeedbackOps(db: DbAdapter) {
  return {
    async submitFeedback(data: {
      consultationId: string;
      userId: string;
      vote: "helpful" | "not_helpful";
      comment?: string;
    }): Promise<FeedbackRecord> {
      const key = KV_KEYS.feedback(data.consultationId, data.userId);
      const existing = await db.get<FeedbackRecord>(key);
      if (existing) return existing;

      const record: FeedbackRecord = {
        id: randomUUID(),
        consultationId: data.consultationId,
        userId: data.userId,
        vote: data.vote,
        comment: data.comment,
        createdAt: Date.now(),
      };

      await db.set(key, record);
      return record;
    },

    async getFeedback(
      consultationId: string,
      userId: string
    ): Promise<FeedbackRecord | null> {
      return db.get<FeedbackRecord>(
        KV_KEYS.feedback(consultationId, userId)
      );
    },
  };
}
