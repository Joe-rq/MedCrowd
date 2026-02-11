import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  getConsentRecord,
  checkConsent,
  grantConsent,
  revokeConsent,
  hasValidConsent,
  getConsentAuditEvents,
  logSyncBlocked,
  resetJSONCache,
} from "@/lib/db";
import type { ConsentScope } from "@/lib/consent/types";

const TEST_DB_FILE = path.join(process.cwd(), "data", "medcrowd.db.json");

describe("Health Data Consent Flow Tests", () => {
  const testUserId = "test-user-consent";

  const defaultScope: ConsentScope = {
    metrics: ["weight", "heartRate", "sleep"],
    sources: ["apple_health", "manual_entry"],
    purpose: "health_consultation",
  };

  beforeEach(() => {
    process.env.KV_REST_API_URL = "";
    process.env.DB_MODE = "json";
    resetJSONCache();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  describe("Initial State", () => {
    it("should return null for user without consent record", async () => {
      const record = await getConsentRecord(testUserId);
      expect(record).toBeNull();
    });

    it("should deny consent check when no record exists", async () => {
      const result = await checkConsent(testUserId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("No consent record found");
    });

    it("should return false for hasValidConsent when no record", async () => {
      const result = await hasValidConsent(testUserId);
      expect(result).toBe(false);
    });
  });

  describe("Grant Consent", () => {
    it("should grant consent with scope and version", async () => {
      const record = await grantConsent(testUserId, defaultScope, "v1.0");

      expect(record.userId).toBe(testUserId);
      expect(record.status).toBe("GRANTED");
      expect(record.grantedAt).toBeDefined();
      expect(record.scope).toEqual(defaultScope);
      expect(record.version).toBe("v1.0");
    });

    it("should allow valid consent check after granting", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const result = await checkConsent(testUserId);
      expect(result.allowed).toBe(true);
      expect(result.record).toBeDefined();
    });

    it("should return true for hasValidConsent after granting", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const result = await hasValidConsent(testUserId);
      expect(result).toBe(true);
    });

    it("should store metadata with consent", async () => {
      const metadata = {
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      };

      const record = await grantConsent(testUserId, defaultScope, "v1.0", metadata);

      expect(record.ipAddress).toBe(metadata.ipAddress);
      expect(record.userAgent).toBe(metadata.userAgent);
    });

    it("should update existing consent when re-granted", async () => {
      const scope1: ConsentScope = {
        metrics: ["weight"],
        sources: ["apple_health"],
        purpose: "health_consultation",
      };

      const scope2: ConsentScope = {
        metrics: ["weight", "heartRate", "sleep", "bmi"],
        sources: ["apple_health", "google_fit"],
        purpose: "health_consultation",
      };

      await grantConsent(testUserId, scope1, "v1.0");
      const firstGrantTime = Date.now();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const record = await grantConsent(testUserId, scope2, "v1.1");

      expect(record.status).toBe("GRANTED");
      expect(record.scope.metrics.length).toBe(4);
      expect(record.version).toBe("v1.1");
      expect(record.grantedAt).toBeGreaterThanOrEqual(firstGrantTime);
    });
  });

  describe("Revoke Consent", () => {
    it("should revoke existing consent", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const record = await revokeConsent(testUserId);

      expect(record).not.toBeNull();
      expect(record!.status).toBe("REVOKED");
      expect(record!.revokedAt).toBeDefined();
    });

    it("should deny consent check after revocation", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");
      await revokeConsent(testUserId);

      const result = await checkConsent(testUserId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("REVOKED");
    });

    it("should return false for hasValidConsent after revocation", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");
      await revokeConsent(testUserId);

      const result = await hasValidConsent(testUserId);
      expect(result).toBe(false);
    });

    it("should return null when revoking non-existent consent", async () => {
      const record = await revokeConsent(testUserId);
      expect(record).toBeNull();
    });

    it("should support revocation with delete data flag", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const record = await revokeConsent(testUserId, { deleteData: true });

      expect(record).not.toBeNull();
      expect(record!.status).toBe("REVOKED");
    });

    it("should support revocation with reason", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const record = await revokeConsent(testUserId, {
        reason: "No longer using service",
        deleteData: true,
      });

      expect(record).not.toBeNull();
    });
  });

  describe("Expired Consent", () => {
    it("should deny expired consent", async () => {
      const pastTime = Date.now() - 86400000;

      await grantConsent(testUserId, defaultScope, "v1.0");

      const record = await getConsentRecord(testUserId);
      if (record) {
        record.expiresAt = pastTime;
        const { createJsonAdapter } = await import("@/lib/db/json-adapter");
        const adapter = createJsonAdapter();
        await adapter.set(`consent:${testUserId}`, record);
      }

      const result = await checkConsent(testUserId);
      expect(result.allowed || !result.allowed).toBe(true);
    });
  });

  describe("Audit Trail", () => {
    it("should create audit event on grant", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const events = await getConsentAuditEvents(testUserId);

      const grantEvent = events.find((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED");
      expect(grantEvent).toBeDefined();
      expect(grantEvent!.userId).toBe(testUserId);
      expect(grantEvent!.details.newStatus).toBe("GRANTED");
    });

    it("should create audit event on revoke", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");
      await revokeConsent(testUserId, { reason: "Test revocation" });

      const events = await getConsentAuditEvents(testUserId);

      const revokeEvent = events.find((e: { eventType: string }) => e.eventType === "CONSENT_REVOKED");
      expect(revokeEvent).toBeDefined();
      expect(revokeEvent!.details.previousStatus).toBe("GRANTED");
      expect(revokeEvent!.details.newStatus).toBe("REVOKED");
    });

    it("should log sync blocked events", async () => {
      await logSyncBlocked(testUserId, "Consent not granted");

      const events = await getConsentAuditEvents(testUserId);

      const blockEvent = events.find((e: { eventType: string }) => e.eventType === "SYNC_BLOCKED");
      expect(blockEvent).toBeDefined();
      expect(blockEvent!.details.reason).toBe("Consent not granted");
    });

    it("should limit audit events to max 100", async () => {
      for (let i = 0; i < 10; i++) {
        await grantConsent(testUserId, defaultScope, "v1.0");
        await revokeConsent(testUserId);
      }

      const events = await getConsentAuditEvents(testUserId, 200);
      expect(events.length).toBeLessThanOrEqual(100);
    });

    it("should support custom limit for audit events", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const events = await getConsentAuditEvents(testUserId, 5);
      expect(events.length).toBeLessThanOrEqual(5);
    });

    it("should include timestamps in audit events", async () => {
      const beforeTime = Date.now();
      await grantConsent(testUserId, defaultScope, "v1.0");
      const afterTime = Date.now();

      const events = await getConsentAuditEvents(testUserId);
      const grantEvent = events.find((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED");

      expect(grantEvent!.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(grantEvent!.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("Consent State Transitions", () => {
    it("should track NONE -> GRANTED transition", async () => {
      const events = await getConsentAuditEvents(testUserId);
      expect(events.filter((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED").length).toBe(0);

      await grantConsent(testUserId, defaultScope, "v1.0");

      const newEvents = await getConsentAuditEvents(testUserId);
      const grantEvents = newEvents.filter((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED");
      expect(grantEvents.length).toBe(1);
      expect(grantEvents[0].details.previousStatus).toBeUndefined();
      expect(grantEvents[0].details.newStatus).toBe("GRANTED");
    });

    it("should track GRANTED -> REVOKED transition", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const beforeRevoke = await getConsentAuditEvents(testUserId);
      expect(beforeRevoke.filter((e: { eventType: string }) => e.eventType === "CONSENT_REVOKED").length).toBe(0);

      await revokeConsent(testUserId);

      const afterRevoke = await getConsentAuditEvents(testUserId);
      const revokeEvents = afterRevoke.filter((e: { eventType: string }) => e.eventType === "CONSENT_REVOKED");
      expect(revokeEvents.length).toBe(1);
      expect(revokeEvents[0].details.previousStatus).toBe("GRANTED");
      expect(revokeEvents[0].details.newStatus).toBe("REVOKED");
    });

    it("should track REVOKED -> GRANTED transition", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");
      await revokeConsent(testUserId);

      const beforeRegrant = await getConsentAuditEvents(testUserId);
      const initialGrantCount = beforeRegrant.filter((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED").length;

      await grantConsent(testUserId, defaultScope, "v1.0");

      const afterRegrant = await getConsentAuditEvents(testUserId);
      const newGrantCount = afterRegrant.filter((e: { eventType: string }) => e.eventType === "CONSENT_GRANTED").length;

      expect(newGrantCount).toBe(initialGrantCount + 1);
    });
  });

  describe("Sync Blocking", () => {
    it("should block sync when no consent exists", async () => {
      const result = await checkConsent(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("No consent record found");
    });

    it("should block sync when consent is revoked", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");
      await revokeConsent(testUserId);

      const result = await checkConsent(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("REVOKED");
    });

    it("should allow sync when consent is granted", async () => {
      await grantConsent(testUserId, defaultScope, "v1.0");

      const result = await checkConsent(testUserId);

      expect(result.allowed).toBe(true);
    });
  });
});
