// HealthBrief Formatter - Converts HealthBrief to Consultation Input
// Version: 1.0.0

import type {
  HealthBrief,
  HealthBriefMetric,
  FormattedConsultationInput,
} from "./types";
import type { Anomaly, AnomalySeverity } from "@/lib/anomaly/types";
import type { HealthMetricType } from "@/lib/db/types";

// Metric display names in Chinese
const METRIC_DISPLAY_NAMES: Record<HealthMetricType, string> = {
  weight: "体重",
  bmi: "BMI",
  sleep: "睡眠",
  heartRate: "心率",
  hrv: "心率变异性",
};

// Unit display helpers
function formatValue(metric: HealthBriefMetric): string {
  return `${metric.value}${metric.unit}`;
}

function formatMetricLine(metric: HealthBriefMetric): string {
  const name = METRIC_DISPLAY_NAMES[metric.type];
  const time = new Date(metric.timestamp).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `- ${name}: ${formatValue(metric)}（采集于 ${time}）`;
}

function formatAnomalyLine(anomaly: Anomaly): string {
  const severityEmoji: Record<AnomalySeverity, string> = {
    mild: "⚠️",
    moderate: "⚡",
    attention: "🚨",
  };

  const severityText: Record<AnomalySeverity, string> = {
    mild: "轻微",
    moderate: "中等",
    attention: "需要关注",
  };

  return `${severityEmoji[anomaly.severity]} ${
    METRIC_DISPLAY_NAMES[anomaly.metricType]
  }: ${severityText[anomaly.severity]} - ${anomaly.rationale}`;
}

/**
 * Build the consultation question from HealthBrief data
 */
function buildQuestion(brief: HealthBrief): string {
  const parts: string[] = [];

  // Header
  parts.push("基于健康数据的自动咨询请求");
  parts.push("");

  // Metrics summary
  parts.push("【健康指标快照】");
  brief.metrics.forEach((metric) => {
    parts.push(formatMetricLine(metric));
  });

  parts.push("");

  // Anomalies summary
  if (brief.anomalies.length > 0) {
    parts.push("【检测到的异常】");
    brief.anomalies.forEach((anomaly) => {
      parts.push(formatAnomalyLine(anomaly));
    });
    parts.push("");
  }

  // User notes
  if (brief.context.notes) {
    parts.push("【用户补充说明】");
    parts.push(brief.context.notes);
    parts.push("");
  }

  // Consultation request
  parts.push("【咨询问题】");
  parts.push(
    `根据上述健康数据，特别是检测到的${brief.anomalies.length}项异常变化，`
  );
  parts.push(
    "希望了解是否需要就医检查，以及日常生活中需要注意的事项。"
  );

  return parts.join("\n");
}

/**
 * Determine consultation priority based on anomaly severity
 */
function determinePriority(brief: HealthBrief): FormattedConsultationInput["priority"] {
  if (!brief.maxSeverity) return "normal";

  const priorityMap: Record<AnomalySeverity, FormattedConsultationInput["priority"]> = {
    mild: "low",
    moderate: "normal",
    attention: "high",
  };

  return priorityMap[brief.maxSeverity];
}

/**
 * Build metrics summary for consultation context
 */
function buildMetricsSummary(brief: HealthBrief): string {
  const lines = brief.metrics.map((metric) => {
    const name = METRIC_DISPLAY_NAMES[metric.type];
    return `${name}: ${formatValue(metric)}`;
  });
  return lines.join("，");
}

/**
 * Build anomalies summary for consultation context
 */
function buildAnomaliesSummary(brief: HealthBrief): string {
  if (brief.anomalies.length === 0) {
    return "未发现明显异常";
  }

  const lines = brief.anomalies.map((anomaly) => {
    return `${METRIC_DISPLAY_NAMES[anomaly.metricType]}: ${anomaly.rationale}`;
  });

  return lines.join("；");
}

/**
 * Format a HealthBrief into consultation orchestrator input
 * This is the main entry point for the formatter
 */
export function formatForConsultation(
  brief: HealthBrief
): FormattedConsultationInput {
  return {
    question: buildQuestion(brief),
    priority: determinePriority(brief),
    healthContext: {
      metricsSummary: buildMetricsSummary(brief),
      anomaliesSummary: buildAnomaliesSummary(brief),
      userNotes: brief.context.notes,
    },
    metadata: {
      briefId: brief.id,
      maxSeverity: brief.maxSeverity,
      anomalyCount: brief.anomalies.length,
    },
  };
}

/**
 * Format for preview (UI display before submission)
 */
export function formatForPreview(brief: HealthBrief): string {
  const parts: string[] = [];

  parts.push("健康简报预览");
  parts.push("=".repeat(30));
  parts.push("");

  parts.push(`状态: ${brief.status}`);
  parts.push(`检测异常数: ${brief.anomalies.length}`);
  parts.push(`最高严重程度: ${brief.maxSeverity ?? "无"}`);
  parts.push("");

  parts.push("指标详情:");
  brief.metrics.forEach((metric) => {
    parts.push(formatMetricLine(metric));
  });

  if (brief.anomalies.length > 0) {
    parts.push("");
    parts.push("异常详情:");
    brief.anomalies.forEach((anomaly) => {
      parts.push(formatAnomalyLine(anomaly));
    });
  }

  parts.push("");
  parts.push("=".repeat(30));
  parts.push(`将${brief.triggerDecision.shouldTrigger ? "" : "不"}触发咨询`);
  parts.push(`原因: ${brief.triggerDecision.reason}`);

  return parts.join("\n");
}

/**
 * Build a short summary for notification/display purposes
 */
export function buildShortSummary(brief: HealthBrief): string {
  if (brief.anomalies.length === 0) {
    return `健康简报：${brief.metrics.length}项指标正常`;
  }

  const severityEmoji: Record<AnomalySeverity, string> = {
    mild: "⚠️",
    moderate: "⚡",
    attention: "🚨",
  };

  const emoji = brief.maxSeverity ? severityEmoji[brief.maxSeverity] : "";
  return `${emoji} 健康简报：检测到${brief.anomalies.length}项异常（最高${
    brief.maxSeverity === "attention"
      ? "需关注"
      : brief.maxSeverity === "moderate"
      ? "中等"
      : "轻微"
  }）`;
}
