// Database layer types and key schema

export interface DbAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  lpush(key: string, value: string): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ping(): Promise<void>;
}

// Data models

export interface UserRecord {
  id: string;
  secondmeId: string;
  name: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number; // Unix timestamp ms
  consultable: boolean;
  circuitBreakerUntil?: number; // Unix timestamp ms - temporary disable
  createdAt: number;
}

export interface ConsultationRecord {
  id: string;
  askerId: string;
  question: string;
  status: "PENDING" | "CONSULTING" | "DONE" | "FAILED";
  agentCount: number;
  summary: Record<string, unknown> | null;
  triage: Record<string, unknown> | null;
  createdAt: number;
}

export interface AgentResponseRecord {
  id: string;
  consultationId: string;
  responderId: string;
  sessionId: string;
  rawResponse: string;
  keyPoints: string[];
  isValid: boolean;
  invalidReason?: string;
  latencyMs: number;
  createdAt: number;
  round?: "initial" | "reaction";
}

// KV Key schema (centralized)
export const KV_KEYS = {
  user: (userId: string) => `user:${userId}`,
  userBySecondme: (secondmeId: string) => `user:secondme:${secondmeId}`,
  consultableUsers: () => "consultable-users",
  consultation: (consultationId: string) => `consultation:${consultationId}`,
  userConsultations: (userId: string) => `user-consultations:${userId}`,
  responses: (consultationId: string) => `responses:${consultationId}`,
  idempotent: (consultationId: string, round: number, agentId: string) =>
    `consultation:${consultationId}:round:${round}:agent:${agentId}`,
};
