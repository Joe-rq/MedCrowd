// Database layer types and key schema

export interface DbAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }): Promise<boolean | void>;
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
  bio?: string;    // From SecondMe user info
  tags?: string[]; // Manual tags for smart matching
  createdAt: number;
}

export interface ConsultationRecord {
  id: string;
  askerId: string;
  question: string;
  status: "PENDING" | "CONSULTING" | "DONE" | "PARTIAL" | "FAILED";
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

// Health Metric Types (V1)

export type HealthMetricType = "weight" | "bmi" | "sleep" | "heartRate" | "hrv";

export type MetricGranularity = "raw" | "weekly";

export interface HealthMetricPoint {
  timestamp: number; // Unix timestamp ms
  value: number;
  unit: string;
  source: string; // e.g., "apple_health", "manual_entry", "fitbit"
  confidence: number; // 0-1, data quality indicator
  metadata?: Record<string, unknown>; // Flexible extension point
}

export interface WeeklySnapshot {
  weekId: string; // ISO week format: "2024-W03"
  startDate: number; // Unix timestamp ms
  endDate: number; // Unix timestamp ms
  metricType: HealthMetricType;
  avg: number;
  min: number;
  max: number;
  count: number;
  unit: string;
  source: string;
  confidence: number;
  // Reference to raw data for audit trail
  rawDataPoints: number;
}

export interface HealthMetricsIndex {
  userId: string;
  metricTypes: HealthMetricType[];
  lastUpdated: number;
  rawRetentionCutoff: number; // Unix timestamp ms - data older than this is in weekly only
}

// Migration trigger tracking
export interface StorageLatencyMetrics {
  operation: string;
  latencyMs: number;
  timestamp: number;
  keyPattern: string;
}

export interface FeedbackRecord {
  id: string;
  consultationId: string;
  userId: string;
  vote: "helpful" | "not_helpful";
  comment?: string;
  createdAt: number;
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
  // Health metrics keys
  health: {
    rawMetric: (userId: string, metricType: HealthMetricType, date: string) =>
      `health:${userId}:raw:${metricType}:${date}`,
    weeklySnapshot: (userId: string, metricType: HealthMetricType, weekId: string) =>
      `health:${userId}:weekly:${metricType}:${weekId}`,
    userMetricsIndex: (userId: string) => `health:${userId}:metrics`,
    latencyMetrics: (timestamp: number) => `health:metrics:latency:${timestamp}`,
  },
  // Feedback keys
  feedback: (consultationId: string, userId: string) =>
    `feedback:${consultationId}:${userId}`,
  // Consent and audit keys
  consent: {
    record: (userId: string) => `consent:${userId}`,
    auditEvents: (userId: string) => `consent:audit:${userId}`,
  },
};

// Retention constants
export const RETENTION = {
  RAW_DAYS: 7,
  WEEKLY_DAYS: 90,
  RAW_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days
  WEEKLY_TTL_SECONDS: 90 * 24 * 60 * 60, // 90 days
};

// Migration trigger thresholds
export const MIGRATION_TRIGGERS = {
  P95_LATENCY_MS: 300,
  RETENTION_DAYS: 180,
};
