// Anomaly detection rules for V1 health metrics
// Non-diagnostic, safety-compliant thresholds and trends

import type {
  ThresholdRule,
  TrendRule,
  AnomalyRule,
} from "./types";
import type { HealthMetricType } from "@/lib/db/types";

// Threshold rules: Absolute value boundaries
export const THRESHOLD_RULES: ThresholdRule[] = [
  // Weight rules
  {
    id: "weight-change-7d",
    metricType: "weight",
    ruleType: "threshold",
    enabled: true,
    priority: 100,
    percentageChange: 0.05, // >5% change
    lookbackDays: 7,
  },
  // Sleep rules
  {
    id: "sleep-duration-low",
    metricType: "sleep",
    ruleType: "threshold",
    enabled: true,
    priority: 90,
    minValue: 4, // <4 hours
    lookbackDays: 1,
  },
  {
    id: "sleep-duration-high",
    metricType: "sleep",
    ruleType: "threshold",
    enabled: true,
    priority: 90,
    maxValue: 12, // >12 hours
    lookbackDays: 1,
  },
  // Heart rate rules
  {
    id: "heartrate-resting-high",
    metricType: "heartRate",
    ruleType: "threshold",
    enabled: true,
    priority: 110,
    maxValue: 100, // >100 bpm resting
    lookbackDays: 3,
  },
  {
    id: "heartrate-resting-low",
    metricType: "heartRate",
    ruleType: "threshold",
    enabled: true,
    priority: 90,
    minValue: 40, // <40 bpm
    lookbackDays: 3,
  },
  // BMI rules (population reference)
  {
    id: "bmi-range",
    metricType: "bmi",
    ruleType: "threshold",
    enabled: true,
    priority: 80,
    minValue: 18.5,
    maxValue: 30,
    lookbackDays: 1,
  },
  // HRV rules (lower is generally less favorable for resting)
  {
    id: "hrv-extremely-low",
    metricType: "hrv",
    ruleType: "threshold",
    enabled: true,
    priority: 85,
    minValue: 20, // ms, very low HRV
    lookbackDays: 7,
  },
];

// Trend rules: Pattern detection over time
export const TREND_RULES: TrendRule[] = [
  // Weight trend
  {
    id: "weight-trend-consecutive",
    metricType: "weight",
    ruleType: "trend",
    enabled: true,
    priority: 95,
    consecutivePeriods: 3, // 3+ consecutive weeks
    direction: "either",
    minChangePerPeriod: 0.3, // kg per week
  },
  // Sleep irregularity
  {
    id: "sleep-schedule-irregular",
    metricType: "sleep",
    ruleType: "trend",
    enabled: true,
    priority: 85,
    consecutivePeriods: 7, // 7+ days
    direction: "either",
    highVariance: true, // High variance in onset time
  },
  // Heart rate trending up
  {
    id: "heartrate-trend-up",
    metricType: "heartRate",
    ruleType: "trend",
    enabled: true,
    priority: 100,
    consecutivePeriods: 5, // 5+ consecutive days
    direction: "increasing",
    minChangePerPeriod: 3, // bpm per day
  },
  // Sleep trending down
  {
    id: "sleep-trend-down",
    metricType: "sleep",
    ruleType: "trend",
    enabled: true,
    priority: 90,
    consecutivePeriods: 5,
    direction: "decreasing",
    minChangePerPeriod: 0.3, // hours per day
  },
];

// Combined rule set
export const ALL_ANOMALY_RULES: AnomalyRule[] = [
  ...THRESHOLD_RULES,
  ...TREND_RULES,
];

// Get rules for a specific metric
export function getRulesForMetric(
  metricType: HealthMetricType
): AnomalyRule[] {
  return ALL_ANOMALY_RULES.filter(
    (rule) => rule.metricType === metricType && rule.enabled
  ).sort((a, b) => b.priority - a.priority);
}

// Get threshold rules for a metric
export function getThresholdRulesForMetric(
  metricType: HealthMetricType
): ThresholdRule[] {
  return THRESHOLD_RULES.filter(
    (rule) => rule.metricType === metricType && rule.enabled
  );
}

// Get trend rules for a metric
export function getTrendRulesForMetric(
  metricType: HealthMetricType
): TrendRule[] {
  return TREND_RULES.filter(
    (rule) => rule.metricType === metricType && rule.enabled
  );
}

// Rule metadata for UI display
export interface RuleMetadata {
  id: string;
  name: string;
  description: string;
  metricType: HealthMetricType;
}

export const RULE_METADATA: Record<string, RuleMetadata> = {
  "weight-change-7d": {
    id: "weight-change-7d",
    name: "体重短期变化",
    description: "7天内体重变化超过5%",
    metricType: "weight",
  },
  "sleep-duration-low": {
    id: "sleep-duration-low",
    name: "睡眠时长较短",
    description: "单日睡眠少于4小时",
    metricType: "sleep",
  },
  "sleep-duration-high": {
    id: "sleep-duration-high",
    name: "睡眠时长较长",
    description: "单日睡眠超过12小时",
    metricType: "sleep",
  },
  "heartrate-resting-high": {
    id: "heartrate-resting-high",
    name: "静息心率偏高",
    description: "静息心率超过100次/分钟",
    metricType: "heartRate",
  },
  "heartrate-resting-low": {
    id: "heartrate-resting-low",
    name: "静息心率偏低",
    description: "静息心率低于40次/分钟",
    metricType: "heartRate",
  },
  "bmi-range": {
    id: "bmi-range",
    name: "BMI范围",
    description: "BMI超出18.5-30范围",
    metricType: "bmi",
  },
  "hrv-extremely-low": {
    id: "hrv-extremely-low",
    name: "心率变异性偏低",
    description: "HRV低于20ms",
    metricType: "hrv",
  },
  "weight-trend-consecutive": {
    id: "weight-trend-consecutive",
    name: "体重连续变化",
    description: "连续3周以上体重持续增加或减少",
    metricType: "weight",
  },
  "sleep-schedule-irregular": {
    id: "sleep-schedule-irregular",
    name: "睡眠不规律",
    description: "连续7天入睡时间差异较大",
    metricType: "sleep",
  },
  "heartrate-trend-up": {
    id: "heartrate-trend-up",
    name: "心率持续上升",
    description: "连续5天静息心率持续上升",
    metricType: "heartRate",
  },
  "sleep-trend-down": {
    id: "sleep-trend-down",
    name: "睡眠持续减少",
    description: "连续5天睡眠时长持续减少",
    metricType: "sleep",
  },
};
