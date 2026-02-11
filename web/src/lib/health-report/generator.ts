// Weekly Health Report Generator
// Aggregates metrics, detects trends, generates wellness-focused narrative

import type {
  WeeklySnapshot,
  HealthMetricType,
} from "@/lib/db/types";
import type { HealthMetricsOps } from "@/lib/db/health-metrics";
import type {
  WeeklyHealthReport,
  MetricTrend,
  AnomalyContext,
  NextWeekAdvice,
  Milestone,
  TrendDirection,
  AnomalySeverity,
  ReportGenerationOptions,
} from "./types";
import { METRIC_DISPLAY_CONFIG, POPULATION_REFERENCES } from "./types";

function getWeekId(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

function getWeekBounds(weekId: string): { start: number; end: number } {
  const parts = weekId.split("-W");
  const year = parseInt(parts[0], 10);
  const weekNum = parseInt(parts[1], 10);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const dayOffset = (weekNum - 1) * 7;
  const weekStart = new Date(yearStart.getTime() + dayOffset * 86400000);
  const dayOfWeek = weekStart.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000 + 86399999);
  return { start: weekStart.getTime(), end: weekEnd.getTime() };
}

function getPreviousWeekId(weekId: string): string {
  const bounds = getWeekBounds(weekId);
  const prevWeekStart = bounds.start - 7 * 24 * 60 * 60 * 1000;
  return getWeekId(prevWeekStart);
}

function calculateTrend(
  current: number,
  previous?: number
): { direction: TrendDirection; percentageChange: number; absoluteChange: number } {
  if (previous === undefined || previous === 0) {
    return { direction: "insufficient_data", percentageChange: 0, absoluteChange: 0 };
  }
  const absoluteChange = current - previous;
  const percentageChange = (absoluteChange / previous) * 100;
  const threshold = 0.02;
  const direction: TrendDirection =
    Math.abs(percentageChange) < threshold * 100
      ? "stable"
      : percentageChange > 0
      ? "up"
      : "down";
  return { direction, percentageChange, absoluteChange };
}

function calculateConsistency(values: number[]): { variance: number; description: "high" | "moderate" | "low" } {
  if (values.length < 2) return { variance: 0, description: "high" };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  const cv = mean === 0 ? 0 : variance / mean;
  const description = cv < 0.05 ? "high" : cv < 0.15 ? "moderate" : "low";
  return { variance: Math.round(variance * 100) / 100, description };
}

function detectAnomaly(
  metricType: HealthMetricType,
  current: number,
  baseline?: number,
  populationRef?: { min: number; max: number }
): { severity: AnomalySeverity; deviation: number } {
  const config = METRIC_DISPLAY_CONFIG[metricType];
  let severity: AnomalySeverity = "none";
  let deviation = 0;

  if (baseline !== undefined) {
    deviation = Math.abs(current - baseline);
    if (deviation >= config.thresholds.attention) {
      severity = "attention";
    } else if (deviation >= config.thresholds.moderate) {
      severity = "moderate";
    } else if (deviation >= config.thresholds.mild) {
      severity = "mild";
    }
  }

  if (populationRef && severity === "none") {
    const popDeviation = Math.max(0, populationRef.min - current, current - populationRef.max);
    if (popDeviation > 0) {
      deviation = popDeviation;
      severity = "mild";
    }
  }

  return { severity, deviation };
}

function formatDateRange(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${format(startDate)} - ${format(endDate)}`;
}

async function fetchMetricSnapshots(
  ops: HealthMetricsOps,
  userId: string,
  metricType: HealthMetricType,
  weekId: string
): Promise<{ current: WeeklySnapshot | null; previous: WeeklySnapshot | null; history: WeeklySnapshot[] }> {
  const prevWeekId = getPreviousWeekId(weekId);
  const current = await ops.getWeeklySnapshots(userId, metricType, weekId, weekId).then(r => r[0] || null);
  const previous = await ops.getWeeklySnapshots(userId, metricType, prevWeekId, prevWeekId).then(r => r[0] || null);
  const history = await ops.getWeeklySnapshots(
    userId,
    metricType,
    getWeekId(Date.now() - 90 * 24 * 60 * 60 * 1000),
    weekId
  );
  return { current, previous, history };
}

function calculatePersonalBaseline(history: WeeklySnapshot[]): number | undefined {
  if (history.length < 2) return undefined;
  const recent = history.slice(-4, -1);
  if (recent.length === 0) return undefined;
  const avg = recent.reduce((sum, s) => sum + s.avg, 0) / recent.length;
  return Math.round(avg * 100) / 100;
}

function buildMetricTrend(
  metricType: HealthMetricType,
  current: WeeklySnapshot,
  previous: WeeklySnapshot | null,
  baseline: number | undefined
): MetricTrend {
  const config = METRIC_DISPLAY_CONFIG[metricType];
  const trend = calculateTrend(current.avg, previous?.avg);
  const popRef = POPULATION_REFERENCES[metricType];

  const baselineComparison =
    baseline === undefined
      ? undefined
      : current.avg > baseline * 1.05
      ? "above"
      : current.avg < baseline * 0.95
      ? "below"
      : "within";

  return {
    metricType,
    metricLabel: config.label,
    unit: current.unit,
    currentWeek: {
      avg: current.avg,
      min: current.min,
      max: current.max,
      count: current.count,
      weekId: current.weekId,
    },
    previousWeek: previous
      ? { avg: previous.avg, weekId: previous.weekId }
      : undefined,
    trend,
    baseline: baseline !== undefined ? { value: baseline, comparison: baselineComparison! } : undefined,
    consistency: { variance: 0, description: "high" },
  };
}

function generateAnomalyContext(
  trend: MetricTrend,
  severity: AnomalySeverity,
  deviation: number
): AnomalyContext {
  const factors: Record<HealthMetricType, string[]> = {
    weight: ["近期饮食变化", "运动习惯调整", "水分摄入变化", "测量时间不一致"],
    bmi: ["体重波动", "身高数据更新", "肌肉量变化"],
    sleep: ["作息调整", "压力水平变化", "环境因素", "睡前屏幕使用"],
    heartRate: ["近期压力", "咖啡因摄入", "睡眠质量", "轻微脱水", "运动恢复"],
    hrv: ["压力水平", "恢复状况", "睡眠质量", "训练强度变化"],
  };

  const suggestions: Record<AnomalySeverity, string> = {
    none: "继续保持当前习惯",
    mild: "可以留意相关生活方式因素",
    moderate: "建议关注并考虑记录相关因素",
    attention: "该变化值得关注，如有疑虑建议咨询专业医疗机构",
  };

  let observation = "";
  if (trend.baseline) {
    const direction = trend.trend.absoluteChange > 0 ? "上升" : "下降";
    observation = `您的${trend.metricLabel}较个人基线有所${direction}`;
  } else {
    observation = `您的${trend.metricLabel}数据显示变化`;
  }

  return {
    id: `${trend.metricType}_${Date.now()}`,
    metricType: trend.metricType,
    metricLabel: trend.metricLabel,
    severity,
    observation,
    possibleFactors: factors[trend.metricType].slice(0, 3),
    suggestion: suggestions[severity],
    consultationRecommended: severity === "attention" || severity === "moderate",
  };
}

function generateMilestones(metrics: MetricTrend[]): Milestone[] {
  const milestones: Milestone[] = [];

  const streakMetric = metrics.find((m) => m.currentWeek.count >= 7);
  if (streakMetric) {
    milestones.push({
      type: "streak",
      title: "连续记录达成",
      description: `本周完整记录了${streakMetric.metricLabel}数据`,
    });
  }

  const improvedMetric = metrics.find(
    (m) => m.trend.direction === "down" && (m.metricType === "weight" || m.metricType === "heartRate")
  );
  if (improvedMetric) {
    milestones.push({
      type: "improvement",
      title: "趋势向好",
      description: `${improvedMetric.metricLabel}较上周有所优化`,
    });
  }

  const consistentMetric = metrics.find((m) => m.consistency.description === "high" && m.currentWeek.count >= 5);
  if (consistentMetric) {
    milestones.push({
      type: "consistency",
      title: "数据稳定",
      description: `${consistentMetric.metricLabel}本周数据一致性良好`,
    });
  }

  return milestones.slice(0, 2);
}

function generateNextWeekAdvice(metrics: MetricTrend[], anomalies: AnomalyContext[]): NextWeekAdvice[] {
  const advice: NextWeekAdvice[] = [];

  const attentionAnomalies = anomalies.filter((a) => a.severity === "attention");
  if (attentionAnomalies.length > 0) {
    advice.push({
      category: "attention",
      title: "关注指标变化",
      description: "部分指标显示值得关注的变化，建议持续观察",
      actionableSteps: ["保持规律记录习惯", "注意相关生活因素", "如有疑虑可咨询专业人士"],
    });
  }

  const stableMetrics = metrics.filter((m) => m.trend.direction === "stable");
  if (stableMetrics.length > 0) {
    advice.push({
      category: "continuation",
      title: "保持当前节奏",
      description: "多项指标保持稳定，建议继续保持当前的生活习惯",
      actionableSteps: stableMetrics.slice(0, 2).map((m) => `继续保持${m.metricLabel}的记录习惯`),
    });
  }

  const changedMetrics = metrics.filter((m) => m.trend.direction !== "stable" && m.trend.direction !== "insufficient_data");
  if (changedMetrics.length > 0 && advice.length < 2) {
    advice.push({
      category: "adjustment",
      title: "关注趋势变化",
      description: "部分指标显示变化趋势，可以留意相关因素",
      actionableSteps: ["记录可能影响指标的生活事件", "保持观察，无需过度担忧"],
    });
  }

  return advice.slice(0, 2);
}

function generateNarrative(metrics: MetricTrend[], anomalies: AnomalyContext[], weekRange: { start: number; end: number }): { summary: string; highlight: string; disclaimer: string } {
  const dateRange = formatDateRange(weekRange.start, weekRange.end);
  const recordedMetrics = metrics.map((m) => m.metricLabel).join("、") || "健康数据";

  let summary = `本周（${dateRange}）您共记录了${metrics.length}项健康指标：${recordedMetrics}。`;

  const stableCount = metrics.filter((m) => m.trend.direction === "stable").length;
  const changedCount = metrics.length - stableCount;

  if (stableCount > changedCount) {
    summary += "大部分指标保持稳定。";
  } else if (changedCount > 0) {
    summary += "部分指标呈现变化趋势，建议持续关注。";
  }

  let highlight = "";
  if (anomalies.length === 0) {
    highlight = "本周未检测到需要特别关注的指标变化。继续保持良好的记录习惯！";
  } else {
    const attentionCount = anomalies.filter((a) => a.severity === "attention").length;
    if (attentionCount > 0) {
      highlight = `检测到${attentionCount}项指标变化值得关注，建议留意相关因素。`;
    } else {
      highlight = `注意到${anomalies.length}项指标有所变化，属正常波动范围。`;
    }
  }

  const disclaimer =
    "以上信息基于您的个人数据记录，不构成任何形式的医疗建议、诊断或治疗方案。如有健康疑虑，请咨询专业医疗机构。";

  return { summary, highlight, disclaimer };
}

export interface GenerateReportResult {
  report: WeeklyHealthReport | null;
  error?: string;
}

export async function generateWeeklyReport(
  ops: HealthMetricsOps,
  options: ReportGenerationOptions
): Promise<GenerateReportResult> {
  const { userId, weekId = getWeekId(Date.now()) } = options;
  const weekBounds = getWeekBounds(weekId);

  const metricTypes: HealthMetricType[] = ["weight", "bmi", "sleep", "heartRate", "hrv"];
  const metrics: MetricTrend[] = [];
  const anomalies: AnomalyContext[] = [];

  for (const metricType of metricTypes) {
    const { current, previous, history } = await fetchMetricSnapshots(ops, userId, metricType, weekId);

    if (!current) continue;

    const baseline = calculatePersonalBaseline(history);
    const trend = buildMetricTrend(metricType, current, previous, baseline);
    metrics.push(trend);

    const { severity, deviation } = detectAnomaly(
      metricType,
      current.avg,
      baseline,
      POPULATION_REFERENCES[metricType]
    );

    if (severity !== "none") {
      anomalies.push(generateAnomalyContext(trend, severity, deviation));
    }
  }

  if (metrics.length === 0) {
    return { report: null, error: "本周没有足够的数据生成报告" };
  }

  const milestones = generateMilestones(metrics);
  const nextWeekAdvice = generateNextWeekAdvice(metrics, anomalies);
  const narrative = generateNarrative(metrics, anomalies, weekBounds);

  const consultationRecommended = anomalies.some((a) => a.consultationRecommended);
  const consultationHandoff = consultationRecommended
    ? {
        reason: "基于本周数据，部分指标变化建议进一步交流",
        triggeredMetrics: anomalies.filter((a) => a.consultationRecommended).map((a) => a.metricType),
        suggestedQuestion: `我注意到本周${anomalies
          .filter((a) => a.consultationRecommended)
          .map((a) => a.metricLabel)
          .join("、")}有所变化，想了解一下其他用户是否有类似经历。`,
      }
    : undefined;

  const report: WeeklyHealthReport = {
    id: `whr_${userId}_${weekId}_${Date.now()}`,
    userId,
    weekId,
    weekRange: { startDate: weekBounds.start, endDate: weekBounds.end },
    generatedAt: Date.now(),
    metrics,
    anomalies,
    milestones,
    nextWeekAdvice,
    consultationHandoff,
    narrative,
  };

  return { report };
}

export function getReportWeekOptions(): { weekId: string; label: string }[] {
  const options: { weekId: string; label: string }[] = [];
  const now = Date.now();

  for (let i = 0; i < 4; i++) {
    const weekTime = now - i * 7 * 24 * 60 * 60 * 1000;
    const weekId = getWeekId(weekTime);
    const bounds = getWeekBounds(weekId);
    const label = formatDateRange(bounds.start, bounds.end);
    options.push({ weekId, label });
  }

  return options;
}
