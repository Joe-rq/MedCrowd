// HealthBrief Contract - Type Definitions
// Version: 1.0.0
// Purpose: Structured health data representation for anomaly-triggered consultation handoff

import type { Anomaly, AnomalySeverity } from "@/lib/anomaly/types";
import type { HealthMetricType } from "@/lib/db/types";

/**
 * Trigger policy for consultation initiation
 * - "always": Always trigger consultation on HealthBrief submission
 * - "anomaly_only": Only trigger when moderate+ anomaly detected (V1 default)
 * - "user_opt_in": Only trigger when user explicitly opts in
 */
export type TriggerPolicy = "always" | "anomaly_only" | "user_opt_in";

/**
 * Policy version for contract evolution tracking
 */
export type PolicyVersion = "v1";

/**
 * HealthBrief status lifecycle
 */
export type HealthBriefStatus =
  | "pending" // Brief created, anomaly detection pending
  | "analyzed" // Anomaly detection complete
  | "triggered" // Consultation triggered
  | "skipped" // Consultation skipped per policy
  | "failed"; // Processing failed

/**
 * User preference for consultation trigger override
 */
export interface UserTriggerPreference {
  userId: string;
  defaultPolicy: TriggerPolicy;
  overrideSeverity: AnomalySeverity | null; // Override threshold for anomaly_only
  enabled: boolean;
  updatedAt: number;
}

/**
 * Single metric reading in a HealthBrief
 */
export interface HealthBriefMetric {
  type: HealthMetricType;
  value: number;
  unit: string;
  timestamp: number;
  source: string; // e.g., "apple_health", "manual", "fitbit"
  confidence: number; // 0-1
}

/**
 * Context about the health brief submission
 */
export interface HealthBriefContext {
  submittedAt: number;
  submitterUserAgent: string;
  submitterIp?: string; // Optional for privacy
  collectionMethod: "manual" | "sync" | "import";
  notes?: string; // User-provided context
}

/**
 * Core HealthBrief structure
 * Contains snapshot of health metrics for consultation handoff
 */
export interface HealthBrief {
  id: string;
  userId: string;
  version: "1.0.0";
  status: HealthBriefStatus;

  // Core data
  metrics: HealthBriefMetric[];
  context: HealthBriefContext;

  // Anomaly detection results
  anomalies: Anomaly[];
  maxSeverity: AnomalySeverity | null;

  // Policy & trigger state
  policyVersion: PolicyVersion;
  appliedPolicy: TriggerPolicy;
  triggerDecision: {
    shouldTrigger: boolean;
    reason: string;
    triggeredAt?: number;
  };

  // Consultation reference (if triggered)
  consultationId?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating a new HealthBrief
 */
export interface HealthBriefInput {
  userId: string;
  metrics: Array<{
    type: HealthMetricType;
    value: number;
    unit: string;
    timestamp?: number;
    source?: string;
    confidence?: number;
  }>;
  context?: Partial<HealthBriefContext>;
  notes?: string;
}

/**
 * Result of processing a HealthBrief
 */
export interface HealthBriefResult {
  briefId: string;
  status: HealthBriefStatus;
  anomalies: Anomaly[];
  maxSeverity: AnomalySeverity | null;
  consultationTriggered: boolean;
  consultationId?: string;
  skipReason?: string;
}

/**
 * Formatter output for consultation orchestrator integration
 */
export interface FormattedConsultationInput {
  question: string;
  priority: "low" | "normal" | "high" | "urgent";
  healthContext: {
    metricsSummary: string;
    anomaliesSummary: string;
    userNotes?: string;
  };
  metadata: {
    briefId: string;
    maxSeverity: AnomalySeverity | null;
    anomalyCount: number;
  };
}

/**
 * Policy configuration per version
 */
export interface PolicyConfig {
  version: PolicyVersion;
  defaultPolicy: TriggerPolicy;
  anomalyThreshold: AnomalySeverity; // Minimum severity to trigger
  cooldownMs: number; // Minimum time between consultations
  maxMetricsPerBrief: number;
  requireUserConsent: boolean;
}

/**
 * Policy evaluation context
 */
export interface PolicyEvaluationContext {
  userId: string;
  briefId: string;
  anomalies: Anomaly[];
  maxSeverity: AnomalySeverity | null;
  userPreference?: UserTriggerPreference;
  lastConsultationAt?: number;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  shouldTrigger: boolean;
  policy: TriggerPolicy;
  reason: string;
  severity: AnomalySeverity | null;
  appliedAt: number;
}

/**
 * HealthBrief storage record (extends core with DB fields)
 */
export interface HealthBriefRecord extends HealthBrief {
  // Internal tracking
  processingAttempts: number;
  lastError?: string;
  errorAt?: number;
}

/**
 * Metric validation error
 */
export interface MetricValidationError {
  metricType: HealthMetricType;
  field: string;
  message: string;
}

/**
 * Validation result for HealthBrief input
 */
export interface HealthBriefValidationResult {
  valid: boolean;
  errors: MetricValidationError[];
  warnings: string[];
}

/**
 * Event types for HealthBrief lifecycle
 */
export type HealthBriefEvent =
  | { type: "brief:created"; briefId: string; userId: string }
  | { type: "brief:analyzed"; briefId: string; anomalyCount: number; maxSeverity: AnomalySeverity | null }
  | { type: "brief:triggered"; briefId: string; consultationId: string; reason: string }
  | { type: "brief:skipped"; briefId: string; reason: string }
  | { type: "brief:failed"; briefId: string; error: string };
