// Anomaly detection API endpoint
// POST /api/health/anomaly - Check for anomalies in health metrics

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { detectAnomalies, detectAnomaliesBatch } from "@/lib/anomaly/detector";
import type { HealthMetricType } from "@/lib/db/types";
import { ANOMALY_DISCLAIMER } from "@/lib/anomaly/messaging";

// Valid metric types for validation
const VALID_METRIC_TYPES: HealthMetricType[] = [
  "weight",
  "bmi",
  "sleep",
  "heartRate",
  "hrv",
];

// Valid units per metric type
const VALID_UNITS: Record<HealthMetricType, string[]> = {
  weight: ["kg", "lb", "g"],
  bmi: ["kg/m2"],
  sleep: ["hours", "h", "min", "minutes"],
  heartRate: ["bpm"],
  hrv: ["ms"],
};

/**
 * POST /api/health/anomaly
 * Check for anomalies in a single or batch of health metrics
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Support both single metric and batch detection
    if (body.metrics && Array.isArray(body.metrics)) {
      return handleBatchDetection(session.userId, body.metrics);
    }

    return handleSingleDetection(session.userId, body);
  } catch (err) {
    console.error("Anomaly detection error:", err);
    return NextResponse.json(
      { error: "检测过程中出现错误，请稍后重试" },
      { status: 500 }
    );
  }
}

/**
 * Handle single metric anomaly detection
 */
async function handleSingleDetection(
  userId: string,
  body: {
    metricType?: string;
    value?: number;
    unit?: string;
    timestamp?: number;
  }
) {
  const { metricType, value, unit, timestamp } = body;

  // Validation
  if (!metricType || !VALID_METRIC_TYPES.includes(metricType as HealthMetricType)) {
    return NextResponse.json(
      {
        error: "无效的指标类型",
        validTypes: VALID_METRIC_TYPES,
      },
      { status: 400 }
    );
  }

  if (value === undefined || value === null || typeof value !== "number") {
    return NextResponse.json(
      { error: "请提供有效的数值" },
      { status: 400 }
    );
  }

  if (!unit || !VALID_UNITS[metricType as HealthMetricType].includes(unit)) {
    return NextResponse.json(
      {
        error: "无效的单位",
        validUnits: VALID_UNITS[metricType as HealthMetricType],
      },
      { status: 400 }
    );
  }

  // Run detection
  const result = await detectAnomalies(
    userId,
    metricType,
    value,
    unit,
    timestamp
  );

  return NextResponse.json({
    success: true,
    hasAnomaly: result.anomalies.length > 0,
    anomalies: result.anomalies.map((a) => ({
      id: a.id,
      metricType: a.metricType,
      severity: a.severity,
      detectedAt: a.detectedAt,
      currentValue: a.metricValue,
      unit: a.unit,
      baselineValue: a.baselineValue,
      deviation: a.deviation,
      rationale: a.rationale,
      suggestedAction: a.suggestedAction,
    })),
    disclaimer: ANOMALY_DISCLAIMER,
  });
}

/**
 * Handle batch metric anomaly detection
 */
async function handleBatchDetection(
  userId: string,
  metrics: Array<{
    metricType: string;
    value: number;
    unit: string;
    timestamp?: number;
  }>
) {
  if (metrics.length === 0) {
    return NextResponse.json(
      { error: "请提供至少一个指标" },
      { status: 400 }
    );
  }

  if (metrics.length > 10) {
    return NextResponse.json(
      { error: "一次最多检测10个指标" },
      { status: 400 }
    );
  }

  // Validate all metrics
  for (const metric of metrics) {
    if (!metric.metricType || !VALID_METRIC_TYPES.includes(metric.metricType as HealthMetricType)) {
      return NextResponse.json(
        {
          error: `无效的指标类型: ${metric.metricType}`,
          validTypes: VALID_METRIC_TYPES,
        },
        { status: 400 }
      );
    }

    if (typeof metric.value !== "number") {
      return NextResponse.json(
        { error: `指标 ${metric.metricType} 的数值无效` },
        { status: 400 }
      );
    }

    if (!metric.unit || !VALID_UNITS[metric.metricType as HealthMetricType].includes(metric.unit)) {
      return NextResponse.json(
        {
          error: `指标 ${metric.metricType} 的单位无效`,
          validUnits: VALID_UNITS[metric.metricType as HealthMetricType],
        },
        { status: 400 }
      );
    }
  }

  // Run batch detection
  const results = await detectAnomaliesBatch(userId, metrics);

  const allAnomalies = results.flatMap((r) => r.anomalies);

  return NextResponse.json({
    success: true,
    totalChecked: metrics.length,
    hasAnomaly: allAnomalies.length > 0,
    anomalyCount: allAnomalies.length,
    anomalies: allAnomalies.map((a) => ({
      id: a.id,
      metricType: a.metricType,
      severity: a.severity,
      detectedAt: a.detectedAt,
      currentValue: a.metricValue,
      unit: a.unit,
      baselineValue: a.baselineValue,
      deviation: a.deviation,
      rationale: a.rationale,
      suggestedAction: a.suggestedAction,
    })),
    disclaimer: ANOMALY_DISCLAIMER,
  });
}

/**
 * GET /api/health/anomaly
 * Get supported metric types and rules info
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  return NextResponse.json({
    supportedMetrics: VALID_METRIC_TYPES.map((type) => ({
      type,
      validUnits: VALID_UNITS[type],
    })),
    thresholdRules: [
      { metric: "weight", condition: "7天内变化>5%" },
      { metric: "sleep", condition: "时长<4小时或>12小时" },
      { metric: "heartRate", condition: "静息心率>100或<40 bpm" },
      { metric: "bmi", condition: "BMI <18.5或>30" },
      { metric: "hrv", condition: "HRV <20ms" },
    ],
    trendRules: [
      { metric: "weight", condition: "连续3周持续增加或减少" },
      { metric: "sleep", condition: "连续7天入睡时间不规律" },
      { metric: "heartRate", condition: "连续5天静息心率持续上升" },
      { metric: "sleep", condition: "连续5天睡眠时长持续减少" },
    ],
    disclaimer: ANOMALY_DISCLAIMER,
  });
}
