// Anomaly detection type definitions for V1 health metrics

import type { HealthMetricType } from "@/lib/db/types";

/**
 * Severity levels for anomalies
 * - mild: Notable change but within expected variance
 * - moderate: Deviation from personal baseline warrants attention
 * - attention: Significant deviation requires professional consultation
 */
export type AnomalySeverity = "mild" | "moderate" | "attention";

/**
 * Types of anomaly detection rules
 * - threshold: Single-point value check against absolute limits
 * - trend: Pattern detection across multiple data points
 */
export type AnomalyRuleType = "threshold" | "trend";

/**
 * Anomaly detection rule configuration
 */
export interface AnomalyRule {
  id: string;
  metricType: HealthMetricType;
  ruleType: AnomalyRuleType;
  enabled: boolean;
  priority: number; // Higher = more important, evaluated first
}

/**
 * Threshold rule: Check if value crosses absolute boundaries
 */
export interface ThresholdRule extends AnomalyRule {
  ruleType: "threshold";
  minValue?: number; // Optional minimum threshold
  maxValue?: number; // Optional maximum threshold
  percentageChange?: number; // Optional % change from baseline
  lookbackDays: number; // Days to consider for baseline calculation
}

/**
 * Trend rule: Detect patterns across time series
 */
export interface TrendRule extends AnomalyRule {
  ruleType: "trend";
  consecutivePeriods: number; // Number of consecutive periods to check
  direction: "increasing" | "decreasing" | "either";
  minChangePerPeriod?: number; // Minimum change per period to count
  highVariance?: boolean; // Flag for irregular schedule detection
}

/**
 * Detected anomaly result
 */
export interface Anomaly {
  id: string;
  ruleId: string;
  metricType: HealthMetricType;
  severity: AnomalySeverity;
  detectedAt: number; // Unix timestamp ms
  metricValue: number;
  unit: string;
  baselineValue?: number;
  deviation: {
    absolute: number;
    percentage?: number;
  };
  rationale: string; // Non-diagnostic explanation
  suggestedAction: string; // Safe next-step guidance
  dataPoints: number; // Number of points used for detection
}

/**
 * Anomaly detection context for a user
 */
export interface DetectionContext {
  userId: string;
  metricType: HealthMetricType;
  currentValue: number;
  unit: string;
  timestamp: number;
  baseline?: {
    value: number;
    source: "personal" | "population" | "hybrid";
    sampleSize: number;
  };
  history: {
    values: number[];
    timestamps: number[];
    weeklySnapshots?: Array<{
      weekId: string;
      avg: number;
      min: number;
      max: number;
    }>;
  };
}

/**
 * Anomaly detection result for a single check
 */
export interface DetectionResult {
  anomalies: Anomaly[];
  checkedAt: number;
  context: DetectionContext;
}

/**
 * Alert payload for user-facing surfaces
 */
export interface AnomalyAlert {
  id: string;
  userId: string;
  metricType: HealthMetricType;
  severity: AnomalySeverity;
  title: string;
  message: string;
  rationale: string;
  nextSteps: string[];
  timestamp: number;
  acknowledged: boolean;
  dismissed: boolean;
}

/**
 * Configuration for anomaly detection system
 */
export interface AnomalyConfig {
  rules: AnomalyRule[];
  enabledMetrics: HealthMetricType[];
  minDataPoints: number; // Minimum points required for detection
  cooldownHours: number; // Hours before re-alerting same anomaly type
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluation {
  ruleId: string;
  triggered: boolean;
  confidence: number; // 0-1
  severity?: AnomalySeverity;
  rationale?: string;
  deviation?: {
    absolute: number;
    percentage?: number;
  };
}
