// Safe messaging templates for anomaly alerts
// All wording follows safety-wording-checklist.md guidelines
// NON-DIAGNOSTIC - Never use clinical terms like "诊断" "治疗" "异常"

import type { AnomalySeverity } from "./types";
import type { HealthMetricType } from "@/lib/db/types";

/**
 * Message template for anomaly alerts
 */
export interface AnomalyMessage {
  title: string;
  message: string;
  suggestedAction: string;
  nextSteps: string[];
}

// Metric display names in Chinese
const METRIC_NAMES: Record<HealthMetricType, string> = {
  weight: "体重",
  bmi: "BMI",
  sleep: "睡眠",
  heartRate: "静息心率",
  hrv: "心率变异性",
};

// Severity display names
const SEVERITY_NAMES: Record<AnomalySeverity, string> = {
  mild: "注意到变化",
  moderate: "建议关注",
  attention: "建议咨询",
};

/**
 * Generate safe, non-diagnostic alert message
 */
export function generateAnomalyMessage(
  metricType: HealthMetricType,
  severity: AnomalySeverity,
  currentValue: number,
  unit: string,
  baselineValue?: number
): AnomalyMessage {
  const metricName = METRIC_NAMES[metricType];

  switch (severity) {
    case "mild":
      return generateMildMessage(metricType, metricName, currentValue, unit, baselineValue);
    case "moderate":
      return generateModerateMessage(metricType, metricName, currentValue, unit, baselineValue);
    case "attention":
      return generateAttentionMessage(metricType, metricName, currentValue, unit, baselineValue);
  }
}

function generateMildMessage(
  metricType: HealthMetricType,
  metricName: string,
  currentValue: number,
  unit: string,
  baselineValue?: number
): AnomalyMessage {
  const changeText = baselineValue
    ? `，较您的个人记录有小幅变化`
    : "";

  const templates: Record<HealthMetricType, AnomalyMessage> = {
    weight: {
      title: `注意到您的${metricName}变化`,
      message: `已记录您的${metricName}：${currentValue}${unit}${changeText}。`,
      suggestedAction: "这是正常的日常波动范围，建议继续观察。",
      nextSteps: [
        "保持当前的健康记录习惯",
        "如变化持续一周以上，可咨询专业人士",
      ],
    },
    bmi: {
      title: `${metricName}数据已更新`,
      message: `您的${metricName}为${currentValue}，该数值可作为健康参考。`,
      suggestedAction: "BMI只是基于体重的初步参考，体型和肌肉量也会影响评估。",
      nextSteps: [
        "结合其他指标综合了解身体状况",
        "如有疑虑，建议咨询专业医疗机构",
      ],
    },
    sleep: {
      title: "睡眠记录已更新",
      message: `已记录您本次睡眠时长：${currentValue}${unit}${changeText}。`,
      suggestedAction: "睡眠时长因人而异，受多种因素影响。",
      nextSteps: [
        "观察近期睡眠模式的变化",
        "保持规律的作息时间",
      ],
    },
    heartRate: {
      title: `注意到您的${metricName}`,
      message: `已记录您的${metricName}：${currentValue}${unit}${changeText}。`,
      suggestedAction: "心率受活动量、情绪、睡眠质量等多种因素影响。",
      nextSteps: [
        "建议在静息状态下测量",
        "如多次测量结果相似，可咨询专业人士",
      ],
    },
    hrv: {
      title: `${metricName}数据已记录`,
      message: `您的${metricName}为${currentValue}${unit}。`,
      suggestedAction: "心率变异性反映身体状态，受运动、压力、睡眠等影响。",
      nextSteps: [
        "保持规律的运动和作息",
        "如持续偏低，建议咨询专业人士",
      ],
    },
  };

  return templates[metricType];
}

function generateModerateMessage(
  metricType: HealthMetricType,
  metricName: string,
  currentValue: number,
  unit: string,
  baselineValue?: number
): AnomalyMessage {
  const changeText = baselineValue
    ? `，较您的个人基线（${baselineValue}${unit}）有所变化`
    : "";

  const templates: Record<HealthMetricType, AnomalyMessage> = {
    weight: {
      title: `您的${metricName}变化值得关注`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，偏离了您的通常范围。`,
      suggestedAction: "建议关注近期饮食、运动或生活习惯的变化。",
      nextSteps: [
        "回顾近期的饮食和运动习惯",
        "如变化持续，建议咨询营养师或医生",
        "保持规律的健康数据记录",
      ],
    },
    bmi: {
      title: `${metricName}偏离参考范围`,
      message: `您的${metricName}（${currentValue}）偏离了一般参考范围${changeText}。`,
      suggestedAction: "这只是一个参考指标，不能单独作为健康评估依据。",
      nextSteps: [
        "结合体脂率、腰围等其他指标综合判断",
        "咨询专业医疗机构进行更全面的评估",
        "关注整体健康而非单一数值",
      ],
    },
    sleep: {
      title: "睡眠时长变化明显",
      message: `您的睡眠时长（${currentValue}${unit}）${changeText}，与通常情况相比有所变化。`,
      suggestedAction: "可能的原因包括：近期压力、作息调整、或环境因素。",
      nextSteps: [
        "记录睡眠日记，追踪变化规律",
        "检查睡眠环境是否舒适",
        "如持续变化，建议咨询睡眠专业人士",
      ],
    },
    heartRate: {
      title: `您的${metricName}持续偏高`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，高于您的通常范围。`,
      suggestedAction: "可能的原因包括：近期压力、睡眠质量变化、或轻度脱水。",
      nextSteps: [
        "确保充足的水分摄入",
        "注意放松和减压",
        "如持续一周以上，建议咨询医疗机构",
      ],
    },
    hrv: {
      title: `${metricName}有所降低`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，处于较低水平。`,
      suggestedAction: "HRV降低可能与疲劳、压力或身体恢复有关。",
      nextSteps: [
        "注意休息和恢复，避免过度运动",
        "关注睡眠质量",
        "如持续偏低，建议咨询专业人士",
      ],
    },
  };

  return templates[metricType];
}

function generateAttentionMessage(
  metricType: HealthMetricType,
  metricName: string,
  currentValue: number,
  unit: string,
  baselineValue?: number
): AnomalyMessage {
  const changeText = baselineValue
    ? `，较您的个人基线（${baselineValue}${unit}）变化明显`
    : "";

  const templates: Record<HealthMetricType, AnomalyMessage> = {
    weight: {
      title: `${metricName}变化明显，建议咨询`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，偏离程度较为明显。`,
      suggestedAction: "该指标变化较明显，建议咨询专业医疗机构确认。",
      nextSteps: [
        "尽快预约医生咨询",
        "整理近期的健康数据供医生参考",
        "注意是否有其他身体变化",
        "⚠️ 本平台仅为经验交流，不能替代专业诊断",
      ],
    },
    bmi: {
      title: `${metricName}明显偏离参考范围`,
      message: `您的${metricName}（${currentValue}）${changeText}，明显高于一般参考范围。`,
      suggestedAction: "建议咨询专业医疗机构进行全面评估。",
      nextSteps: [
        "预约体检或健康咨询",
        "综合评估血压、血糖等其他指标",
        "咨询营养师制定健康计划",
        "⚠️ 本平台仅为经验交流，不能替代专业诊断",
      ],
    },
    sleep: {
      title: "睡眠时长变化明显，建议关注",
      message: `您的睡眠时长（${currentValue}${unit}）${changeText}，与一般建议范围差异较大。`,
      suggestedAction: "长期睡眠不足或过多都可能影响健康，建议咨询专业人士。",
      nextSteps: [
        "记录详细的睡眠日记（入睡时间、醒来时间、睡眠质量）",
        "检查是否存在睡眠障碍",
        "咨询睡眠专科或全科医生",
        "⚠️ 本平台仅为经验交流，不能替代专业诊断",
      ],
    },
    heartRate: {
      title: `${metricName}明显偏高，建议咨询`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，明显高于一般成人范围（60-100bpm）。`,
      suggestedAction: "建议您尽快咨询医疗机构，以排除需要关注的情况。",
      nextSteps: [
        "尽快预约心内科或全科医生",
        "记录心率变化的时间规律",
        "检查是否有胸闷、头晕等不适症状",
        "⚠️ 本平台仅为经验交流，不能替代专业诊断",
      ],
    },
    hrv: {
      title: `${metricName}明显偏低，建议关注`,
      message: `您的${metricName}（${currentValue}${unit}）${changeText}，处于明显偏低水平。`,
      suggestedAction: "HRV明显偏低可能提示身体需要更多恢复，建议咨询专业人士。",
      nextSteps: [
        "适当减少高强度运动，增加休息时间",
        "关注是否存在过度疲劳或压力",
        "如持续偏低，建议咨询医生",
        "⚠️ 本平台仅为经验交流，不能替代专业诊断",
      ],
    },
  };

  return templates[metricType];
}

/**
 * Get notification title based on severity
 */
export function getNotificationTitle(
  severity: AnomalySeverity,
  metricType: HealthMetricType
): string {
  const metricName = METRIC_NAMES[metricType];
  const severityName = SEVERITY_NAMES[severity];

  switch (severity) {
    case "mild":
      return `${metricName}数据更新`;
    case "moderate":
      return `${metricName}${severityName}`;
    case "attention":
      return `${metricName}变化明显`;
  }
}

/**
 * Get notification body
 */
export function getNotificationBody(
  severity: AnomalySeverity,
  metricType: HealthMetricType,
  value: number,
  unit: string
): string {
  const metricName = METRIC_NAMES[metricType];

  switch (severity) {
    case "mild":
      return `已记录您的${metricName}：${value}${unit}，点击查看详情。`;
    case "moderate":
      return `您的${metricName}（${value}${unit}）较平时有所变化，点击查看详情。`;
    case "attention":
      return `您的${metricName}数据有明显变化，建议查看详情并咨询专业人士。`;
  }
}

/**
 * Disclaimer text to append to all anomaly messages
 */
export const ANOMALY_DISCLAIMER =
  "⚠️ 以上信息基于您记录的数据，不构成医疗建议、诊断或治疗方案。如有疑虑，请咨询专业医疗机构。";
