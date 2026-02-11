// Health Report Types - Weekly health report generation and presentation

import type { WeeklySnapshot, HealthMetricType } from "@/lib/db/types";

/**
 * Trend direction for metric comparison
 */
export type TrendDirection = "up" | "down" | "stable" | "insufficient_data";

/**
 * Anomaly severity levels following safety wording guidelines
 */
export type AnomalySeverity = "none" | "mild" | "moderate" | "attention";

/**
 * Metric trend analysis for a single metric type
 */
export interface MetricTrend {
  metricType: HealthMetricType;
  metricLabel: string;
  unit: string;
  currentWeek: {
    avg: number;
    min: number;
    max: number;
    count: number;
    weekId: string;
  };
  previousWeek?: {
    avg: number;
    weekId: string;
  };
  trend: {
    direction: TrendDirection;
    percentageChange: number;
    absoluteChange: number;
  };
  baseline?: {
    value: number;
    comparison: "above" | "below" | "within";
  };
  consistency: {
    variance: number;
    description: "high" | "moderate" | "low";
  };
}

/**
 * Detected anomaly with wellness-focused context
 */
export interface AnomalyContext {
  id: string;
  metricType: HealthMetricType;
  metricLabel: string;
  severity: AnomalySeverity;
  observation: string;
  possibleFactors: string[];
  suggestion: string;
  consultationRecommended: boolean;
}

/**
 * Next week advice block
 */
export interface NextWeekAdvice {
  category: "continuation" | "adjustment" | "attention";
  title: string;
  description: string;
  actionableSteps: string[];
}

/**
 * Milestone achievement
 */
export interface Milestone {
  type: "streak" | "improvement" | "consistency" | "first_record";
  title: string;
  description: string;
}

/**
 * Complete weekly health report
 */
export interface WeeklyHealthReport {
  id: string;
  userId: string;
  weekId: string;
  weekRange: {
    startDate: number;
    endDate: number;
  };
  generatedAt: number;
  metrics: MetricTrend[];
  anomalies: AnomalyContext[];
  milestones: Milestone[];
  nextWeekAdvice: NextWeekAdvice[];
  consultationHandoff?: {
    reason: string;
    triggeredMetrics: HealthMetricType[];
    suggestedQuestion: string;
  };
  narrative: {
    summary: string;
    highlight: string;
    disclaimer: string;
  };
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  userId: string;
  weekId?: string; // If not provided, uses current week
  includeConsultationHandoff?: boolean;
}

/**
 * Metric configuration for report generation
 */
export interface MetricConfig {
  type: HealthMetricType;
  label: string;
  thresholds: {
    mild: number;
    moderate: number;
    attention: number;
  };
  baselineWindowWeeks: number;
}

/**
 * Population reference ranges (for context only, not diagnosis)
 */
export const POPULATION_REFERENCES: Record<
  HealthMetricType,
  { min: number; max: number; source: string }
> = {
  weight: { min: 0, max: 300, source: "general" },
  bmi: { min: 18.5, max: 24.9, source: "WHO" },
  sleep: { min: 7, max: 9, source: "CDC" },
  heartRate: { min: 60, max: 100, source: "AHA" },
  hrv: { min: 20, max: 100, source: "general" },
};

/**
 * Metric display configurations
 */
export const METRIC_DISPLAY_CONFIG: Record<HealthMetricType, MetricConfig> = {
  weight: {
    type: "weight",
    label: "体重",
    thresholds: { mild: 0.5, moderate: 1.0, attention: 2.0 },
    baselineWindowWeeks: 4,
  },
  bmi: {
    type: "bmi",
    label: "BMI",
    thresholds: { mild: 0.5, moderate: 1.0, attention: 2.0 },
    baselineWindowWeeks: 4,
  },
  sleep: {
    type: "sleep",
    label: "睡眠时长",
    thresholds: { mild: 0.5, moderate: 1.0, attention: 2.0 },
    baselineWindowWeeks: 3,
  },
  heartRate: {
    type: "heartRate",
    label: "静息心率",
    thresholds: { mild: 5, moderate: 10, attention: 20 },
    baselineWindowWeeks: 3,
  },
  hrv: {
    type: "hrv",
    label: "心率变异性",
    thresholds: { mild: 5, moderate: 10, attention: 15 },
    baselineWindowWeeks: 3,
  },
};
