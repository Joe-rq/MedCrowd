// Database layer - adapter selection + public API

import type { DbAdapter } from "./types";
import { createJsonAdapter } from "./json-adapter";
import { createKvAdapter } from "./kv-adapter";
import { createUserOps } from "./users";
import { createConsultationOps } from "./consultations";
import { createResponseOps } from "./responses";
import { createHealthMetricsOps } from "./health-metrics";
import { createFeedbackOps } from "./feedback";
import { createConsentOps } from "@/lib/consent/store";

// Re-export types for backward compatibility
export type { UserRecord, ConsultationRecord, AgentResponseRecord, FeedbackRecord } from "./types";
export type {
  HealthMetricType,
  HealthMetricPoint,
  WeeklySnapshot,
  HealthMetricsIndex,
  StorageLatencyMetrics,
} from "./types";

// Environment detection
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const USE_JSON_MODE = process.env.DB_MODE === "json" || !REDIS_URL;

// Create adapter based on environment
const adapter: DbAdapter = USE_JSON_MODE ? createJsonAdapter() : createKvAdapter();

// Instantiate domain operations
const userOps = createUserOps(adapter);
const consultationOps = createConsultationOps(adapter);
const responseOps = createResponseOps(adapter);
const healthMetricsOps = createHealthMetricsOps(adapter);
const consentOps = createConsentOps(adapter);
const feedbackOps = createFeedbackOps(adapter);

// Export flat API (backward compatible)
export const upsertUser = userOps.upsertUser;
export const getUserById = userOps.getUserById;
export const getUserBySecondmeId = userOps.getUserBySecondmeId;
export const getConsultableUsers = userOps.getConsultableUsers;
export const circuitBreakUser = userOps.circuitBreakUser;
export const updateUserTokens = userOps.updateUserTokens;

export const createConsultation = consultationOps.createConsultation;
export const getConsultation = consultationOps.getConsultation;
export const updateConsultation = consultationOps.updateConsultation;
export const getUserConsultations = consultationOps.getUserConsultations;

export const addAgentResponse = responseOps.addAgentResponse;
export const addAgentResponsesBatch = responseOps.addAgentResponsesBatch;
export const getAgentResponses = responseOps.getAgentResponses;

export const addHealthMetric = healthMetricsOps.addRawMetric;
export const addHealthMetricsBatch = healthMetricsOps.addRawMetricsBatch;
export const getHealthMetrics = healthMetricsOps.getRawMetrics;
export const getHealthMetricsForWindow = healthMetricsOps.getMetricsForWindow;
export const saveWeeklyHealthSnapshot = healthMetricsOps.saveWeeklySnapshot;
export const getWeeklyHealthSnapshots = healthMetricsOps.getWeeklySnapshots;
export const aggregateHealthToWeekly = healthMetricsOps.aggregateToWeekly;
export const getUserHealthMetricTypes = healthMetricsOps.getUserMetricTypes;
export const deleteUserHealthMetrics = healthMetricsOps.deleteAllUserMetrics;
export const checkHealthMetricsMigrationTriggers = healthMetricsOps.checkMigrationTriggers;

// Consent operations
export const getConsentRecord = consentOps.getConsentRecord.bind(consentOps);
export const checkConsent = consentOps.checkConsent.bind(consentOps);
export const grantConsent = consentOps.grantConsent.bind(consentOps);
export const revokeConsent = consentOps.revokeConsent.bind(consentOps);
export const hasValidConsent = consentOps.hasValidConsent.bind(consentOps);
export const getConsentAuditEvents = consentOps.getAuditEvents.bind(consentOps);
export const logSyncBlocked = consentOps.logSyncBlocked.bind(consentOps);

// Feedback operations
export const submitFeedback = feedbackOps.submitFeedback;
export const getFeedback = feedbackOps.getFeedback;

// Utility exports
export { resetJsonCache as resetJSONCache } from "./json-adapter";
export { getWeekId } from "./health-metrics";

export async function checkDBHealth(): Promise<{ healthy: boolean; mode: string; error?: string }> {
  try {
    await adapter.ping();
    return { healthy: true, mode: USE_JSON_MODE ? "json" : "kv" };
  } catch (error) {
    return {
      healthy: false,
      mode: USE_JSON_MODE ? "json" : "kv",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Distributed lock helpers
export async function acquireLock(key: string, ttlSeconds: number = 10): Promise<boolean> {
  const result = await adapter.set(`lock:${key}`, "1", { ex: ttlSeconds, nx: true });
  return result === true;
}

export async function releaseLock(key: string): Promise<void> {
  await adapter.del(`lock:${key}`);
}

// KV event helpers (for SSE streaming)
export async function pushEvent(key: string, event: string, ttlSeconds: number = 300): Promise<void> {
  await adapter.lpush(key, event);
  // Set TTL on first push (approximate — lpush doesn't support ex, so we use set for a sentinel)
  const sentinelKey = `${key}:ttl`;
  const exists = await adapter.get(sentinelKey);
  if (!exists) {
    await adapter.set(sentinelKey, "1", { ex: ttlSeconds });
  }
}

export async function getEvents(key: string, start: number, stop: number): Promise<string[]> {
  return adapter.lrange(key, start, stop);
}

export function getDBMode(): "json" | "kv" {
  return USE_JSON_MODE ? "json" : "kv";
}
