// Consent storage operations with audit trail

import { randomUUID } from "crypto";
import type { DbAdapter } from "@/lib/db/types";
import { KV_KEYS } from "@/lib/db/types";
import type {
  ConsentRecord,
  ConsentAuditEvent,
  ConsentStatus,
  ConsentCheckResult,
  ConsentScope,
} from "./types";

const MAX_AUDIT_EVENTS = 100;

export function createConsentOps(db: DbAdapter) {
  return {
    async getConsentRecord(userId: string): Promise<ConsentRecord | null> {
      const record = await db.get<ConsentRecord>(KV_KEYS.consent.record(userId));
      return record;
    },

    async checkConsent(userId: string): Promise<ConsentCheckResult> {
      const record = await this.getConsentRecord(userId);

      if (!record) {
        return {
          allowed: false,
          reason: "No consent record found",
        };
      }

      if (record.status !== "GRANTED") {
        return {
          allowed: false,
          reason: `Consent status is ${record.status}`,
          record,
        };
      }

      if (record.expiresAt && record.expiresAt < Date.now()) {
        return {
          allowed: false,
          reason: "Consent has expired",
          record,
        };
      }

      return {
        allowed: true,
        record,
      };
    },

    async grantConsent(
      userId: string,
      scope: ConsentScope,
      version: string,
      metadata?: { ipAddress?: string; userAgent?: string }
    ): Promise<ConsentRecord> {
      const now = Date.now();
      const existing = await this.getConsentRecord(userId);

      const record: ConsentRecord = {
        userId,
        status: "GRANTED",
        grantedAt: now,
        revokedAt: undefined,
        expiresAt: undefined,
        scope,
        version,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      };

      await db.set(KV_KEYS.consent.record(userId), record);

      await this.addAuditEvent({
        userId,
        eventType: "CONSENT_GRANTED",
        details: {
          previousStatus: existing?.status,
          newStatus: "GRANTED",
          scope,
          version,
        },
        ...metadata,
      });

      return record;
    },

    async revokeConsent(
      userId: string,
      options?: { reason?: string; deleteData?: boolean; ipAddress?: string; userAgent?: string }
    ): Promise<ConsentRecord | null> {
      const existing = await this.getConsentRecord(userId);
      if (!existing) {
        return null;
      }

      const now = Date.now();
      const record: ConsentRecord = {
        ...existing,
        status: "REVOKED",
        revokedAt: now,
      };

      await db.set(KV_KEYS.consent.record(userId), record);

      await this.addAuditEvent({
        userId,
        eventType: "CONSENT_REVOKED",
        details: {
          previousStatus: existing.status,
          newStatus: "REVOKED",
          reason: options?.reason,
        },
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      });

      if (options?.deleteData) {
        await this.addAuditEvent({
          userId,
          eventType: "DATA_DELETED",
          details: {
            triggeredByRevocation: true,
            reason: options.reason,
          },
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
        });
      }

      return record;
    },

    async addAuditEvent(event: {
      userId: string;
      eventType: ConsentAuditEvent["eventType"];
      details: ConsentAuditEvent["details"];
      ipAddress?: string;
      userAgent?: string;
    }): Promise<void> {
      const auditEvent: ConsentAuditEvent = {
        id: randomUUID(),
        userId: event.userId,
        eventType: event.eventType,
        timestamp: Date.now(),
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      };

      const key = KV_KEYS.consent.auditEvents(event.userId);
      await db.lpush(key, JSON.stringify(auditEvent));

      const events = await db.lrange(key, 0, -1);
      if (events.length > MAX_AUDIT_EVENTS) {
        await db.lrange(key, MAX_AUDIT_EVENTS, -1);
      }
    },

    async getAuditEvents(userId: string, limit = 50): Promise<ConsentAuditEvent[]> {
      const key = KV_KEYS.consent.auditEvents(userId);
      const events = await db.lrange(key, 0, limit - 1);
      return events.map((e) => JSON.parse(e) as ConsentAuditEvent);
    },

    async logSyncBlocked(userId: string, reason: string): Promise<void> {
      await this.addAuditEvent({
        userId,
        eventType: "SYNC_BLOCKED",
        details: { reason },
      });
    },

    async hasValidConsent(userId: string): Promise<boolean> {
      const result = await this.checkConsent(userId);
      return result.allowed;
    },
  };
}
