// Anomaly detection engine for V1 health metrics
// Implements threshold-based and trend-based detection

import { getHealthMetricsForWindow } from "@/lib/db";
import type {
  DetectionContext,
  DetectionResult,
  Anomaly,
  RuleEvaluation,
  ThresholdRule,
  TrendRule,
  AnomalySeverity,
} from "./types";
import {
  getThresholdRulesForMetric,
  getTrendRulesForMetric,
  RULE_METADATA,
} from "./rules";
import { generateAnomalyMessage } from "./messaging";

// Minimum data points required for trend detection
const MIN_DATA_POINTS = 3;

// Minimum data points for baseline calculation
const MIN_BASELINE_POINTS = 2;

/**
 * Calculate baseline from historical data
 */
function calculateBaseline(
  values: number[]
): { value: number; sampleSize: number } | undefined {
  if (values.length < MIN_BASELINE_POINTS) return undefined;

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  return {
    value: Math.round(avg * 100) / 100,
    sampleSize: values.length,
  };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

/**
 * Evaluate a threshold rule against current context
 */
function evaluateThresholdRule(
  rule: ThresholdRule,
  context: DetectionContext
): RuleEvaluation {
  const { currentValue, baseline, history } = context;
  const evalResult: RuleEvaluation = {
    ruleId: rule.id,
    triggered: false,
    confidence: 0,
  };

  // Check absolute thresholds
  if (rule.minValue !== undefined && currentValue < rule.minValue) {
    const deviation = rule.minValue - currentValue;
    const percentage = rule.minValue > 0 ? (deviation / rule.minValue) * 100 : 0;

    evalResult.triggered = true;
    evalResult.confidence = Math.min(1, deviation / rule.minValue);
    evalResult.severity = determineSeverity("below", percentage, rule.metricType);
    evalResult.rationale = buildRationale(rule, context, "below", deviation, percentage);
    evalResult.deviation = { absolute: -deviation, percentage: -percentage };

    return evalResult;
  }

  if (rule.maxValue !== undefined && currentValue > rule.maxValue) {
    const deviation = currentValue - rule.maxValue;
    const percentage = rule.maxValue > 0 ? (deviation / rule.maxValue) * 100 : 0;

    evalResult.triggered = true;
    evalResult.confidence = Math.min(1, deviation / rule.maxValue);
    evalResult.severity = determineSeverity("above", percentage, rule.metricType);
    evalResult.rationale = buildRationale(rule, context, "above", deviation, percentage);
    evalResult.deviation = { absolute: deviation, percentage };

    return evalResult;
  }

  // Check percentage change from baseline
  if (rule.percentageChange !== undefined && baseline) {
    const change = Math.abs(currentValue - baseline.value);
    const percentage = baseline.value > 0 ? (change / baseline.value) * 100 : 0;

    if (percentage > rule.percentageChange * 100) {
      evalResult.triggered = true;
      evalResult.confidence = Math.min(1, percentage / 100);
      evalResult.severity = determineSeverity(
        currentValue > baseline.value ? "above" : "below",
        percentage,
        rule.metricType
      );
      evalResult.rationale = buildRationale(
        rule,
        context,
        currentValue > baseline.value ? "above" : "below",
        change,
        percentage
      );
      evalResult.deviation = {
        absolute: currentValue - baseline.value,
        percentage: currentValue > baseline.value ? percentage : -percentage,
      };
    }
  }

  return evalResult;
}

/**
 * Evaluate a trend rule against historical data
 */
function evaluateTrendRule(
  rule: TrendRule,
  context: DetectionContext
): RuleEvaluation {
  const { history } = context;
  const evalResult: RuleEvaluation = {
    ruleId: rule.id,
    triggered: false,
    confidence: 0,
  };

  if (history.values.length < rule.consecutivePeriods) {
    return evalResult;
  }

  // High variance detection (for irregular schedules)
  if (rule.highVariance) {
    const mean =
      history.values.reduce((a, b) => a + b, 0) / history.values.length;
    const stdDev = calculateStdDev(history.values, mean);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    // CV > 0.3 indicates high variance (>30% relative to mean)
    if (coefficientOfVariation > 0.3) {
      evalResult.triggered = true;
      evalResult.confidence = Math.min(1, coefficientOfVariation);
      evalResult.severity = "mild";
      evalResult.rationale = `注意到您的数据波动性较大（离散系数 ${(coefficientOfVariation * 100).toFixed(1)}%），可能存在不规律的情况`;
      evalResult.deviation = { absolute: stdDev };
    }

    return evalResult;
  }

  // Trend direction detection
  const recentValues = history.values.slice(-rule.consecutivePeriods);
  let consecutiveCount = 1;
  let totalChange = 0;

  for (let i = 1; i < recentValues.length; i++) {
    const change = recentValues[i] - recentValues[i - 1];
    const absChange = Math.abs(change);

    if (absChange < (rule.minChangePerPeriod || 0)) continue;

    const currentDirection = change > 0 ? "increasing" : "decreasing";

    if (
      rule.direction === "either" ||
      currentDirection === rule.direction
    ) {
      if (i === 1 || currentDirection === (change > 0 ? "increasing" : "decreasing")) {
        consecutiveCount++;
        totalChange += change;
      } else {
        break;
      }
    }
  }

  if (consecutiveCount >= rule.consecutivePeriods) {
    evalResult.triggered = true;
    evalResult.confidence = Math.min(1, consecutiveCount / rule.consecutivePeriods);
    evalResult.severity = consecutiveCount >= rule.consecutivePeriods + 2 ? "moderate" : "mild";
    evalResult.rationale = `连续${consecutiveCount}个周期数据${
      totalChange > 0 ? "上升" : "下降"
    }，累计变化${Math.abs(totalChange).toFixed(1)}${context.unit}`;
    evalResult.deviation = { absolute: Math.abs(totalChange) };
  }

  return evalResult;
}

/**
 * Determine severity based on deviation magnitude
 */
function determineSeverity(
  direction: "above" | "below",
  percentage: number,
  metricType: string
): AnomalySeverity {
  // Metric-specific severity thresholds
  const thresholds: Record<string, { moderate: number; attention: number }> = {
    weight: { moderate: 5, attention: 10 },
    sleep: { moderate: 20, attention: 40 },
    heartRate: { moderate: 15, attention: 30 },
    bmi: { moderate: 10, attention: 20 },
    hrv: { moderate: 25, attention: 50 },
  };

  const metricThresholds = thresholds[metricType] || { moderate: 20, attention: 40 };

  if (percentage >= metricThresholds.attention) return "attention";
  if (percentage >= metricThresholds.moderate) return "moderate";
  return "mild";
}

/**
 * Build human-readable rationale
 */
function buildRationale(
  rule: ThresholdRule,
  context: DetectionContext,
  direction: "above" | "below",
  deviation: number,
  percentage: number
): string {
  const meta = RULE_METADATA[rule.id];
  const metricName = meta?.name || context.metricType;

  if (rule.percentageChange !== undefined && context.baseline) {
    return `您的${metricName}（${context.currentValue}${context.unit}）较个人基线（${context.baseline.value}${context.unit}）${
      direction === "above" ? "增加" : "减少"
    }了${Math.abs(percentage).toFixed(1)}%`;
  }

  const thresholdValue = direction === "above" ? rule.maxValue : rule.minValue;
  return `您的${metricName}（${context.currentValue}${context.unit}）${
    direction === "above" ? "高于" : "低于"
  }参考范围（${thresholdValue}${context.unit}）${Math.abs(percentage).toFixed(1)}%`;
}

/**
 * Build anomaly object from rule evaluation
 */
function buildAnomaly(
  ruleId: string,
  evaluation: RuleEvaluation,
  context: DetectionContext
): Anomaly {
  const message = generateAnomalyMessage(
    context.metricType,
    evaluation.severity || "mild",
    context.currentValue,
    context.unit,
    context.baseline?.value
  );

  return {
    id: `${ruleId}-${context.timestamp}`,
    ruleId,
    metricType: context.metricType,
    severity: evaluation.severity || "mild",
    detectedAt: context.timestamp,
    metricValue: context.currentValue,
    unit: context.unit,
    baselineValue: context.baseline?.value,
    deviation: evaluation.deviation || { absolute: 0 },
    rationale: evaluation.rationale || "检测到数据变化",
    suggestedAction: message.suggestedAction,
    dataPoints: context.history.values.length + 1,
  };
}

/**
 * Main detection function: Check for anomalies in health metrics
 */
export async function detectAnomalies(
  userId: string,
  metricType: string,
  currentValue: number,
  unit: string,
  timestamp?: number
): Promise<DetectionResult> {
  const now = timestamp || Date.now();

  // Fetch historical data for baseline and trend calculation
  const lookbackWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
  const windowData = await getHealthMetricsForWindow(
    userId,
    metricType as import("@/lib/db/types").HealthMetricType,
    now - lookbackWindow,
    now
  );

  // Combine raw and weekly data
  const allValues: number[] = [];
  const allTimestamps: number[] = [];

  windowData.raw.forEach((point) => {
    allValues.push(point.value);
    allTimestamps.push(point.timestamp);
  });

  windowData.weekly.forEach((snapshot) => {
    allValues.push(snapshot.avg);
    allTimestamps.push(snapshot.startDate);
  });

  // Build detection context
  const baseline = calculateBaseline(allValues);
  const context: DetectionContext = {
    userId,
    metricType: metricType as import("@/lib/db/types").HealthMetricType,
    currentValue,
    unit,
    timestamp: now,
    baseline: baseline
      ? {
          value: baseline.value,
          source: "personal",
          sampleSize: baseline.sampleSize,
        }
      : undefined,
    history: {
      values: allValues,
      timestamps: allTimestamps,
      weeklySnapshots: windowData.weekly.map((s) => ({
        weekId: s.weekId,
        avg: s.avg,
        min: s.min,
        max: s.max,
      })),
    },
  };

  const anomalies: Anomaly[] = [];

  // Evaluate threshold rules
  const thresholdRules = getThresholdRulesForMetric(
    metricType as import("@/lib/db/types").HealthMetricType
  );

  for (const rule of thresholdRules) {
    const evaluation = evaluateThresholdRule(rule, context);
    if (evaluation.triggered) {
      anomalies.push(buildAnomaly(rule.id, evaluation, context));
    }
  }

  // Evaluate trend rules (requires more data points)
  if (allValues.length >= MIN_DATA_POINTS) {
    const trendRules = getTrendRulesForMetric(
      metricType as import("@/lib/db/types").HealthMetricType
    );

    for (const rule of trendRules) {
      const evaluation = evaluateTrendRule(rule, context);
      if (evaluation.triggered) {
        anomalies.push(buildAnomaly(rule.id, evaluation, context));
      }
    }
  }

  // Sort by severity (attention > moderate > mild)
  const severityOrder = { attention: 3, moderate: 2, mild: 1 };
  anomalies.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  return {
    anomalies,
    checkedAt: now,
    context,
  };
}

/**
 * Batch detect anomalies for multiple metrics
 */
export async function detectAnomaliesBatch(
  userId: string,
  metrics: Array<{
    metricType: string;
    value: number;
    unit: string;
    timestamp?: number;
  }>
): Promise<DetectionResult[]> {
  const results = await Promise.all(
    metrics.map((m) =>
      detectAnomalies(userId, m.metricType, m.value, m.unit, m.timestamp)
    )
  );

  return results;
}
