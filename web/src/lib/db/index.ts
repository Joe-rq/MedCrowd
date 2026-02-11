// Database layer - adapter selection + public API

import type { DbAdapter } from "./types";
import { createJsonAdapter } from "./json-adapter";
import { createKvAdapter } from "./kv-adapter";
import { createUserOps } from "./users";
import { createConsultationOps } from "./consultations";
import { createResponseOps } from "./responses";

// Re-export types for backward compatibility
export type { UserRecord, ConsultationRecord, AgentResponseRecord } from "./types";

// Environment detection
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const USE_JSON_MODE = process.env.DB_MODE === "json" || !REDIS_URL;

// Create adapter based on environment
const adapter: DbAdapter = USE_JSON_MODE ? createJsonAdapter() : createKvAdapter();

// Instantiate domain operations
const userOps = createUserOps(adapter);
const consultationOps = createConsultationOps(adapter);
const responseOps = createResponseOps(adapter);

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

// Utility exports
export { resetJsonCache as resetJSONCache } from "./json-adapter";

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

export function getDBMode(): "json" | "kv" {
  return USE_JSON_MODE ? "json" : "kv";
}
