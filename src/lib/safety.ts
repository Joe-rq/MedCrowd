// High-risk keyword detection for medical safety

const SELF_HARM_KEYWORDS = [
  "自杀", "自残", "不想活", "割腕", "跳楼", "轻生",
  "活着没意思", "想死", "结束生命",
];

const EMERGENCY_KEYWORDS = [
  "胸口剧痛", "呼吸困难", "大量出血", "意识模糊", "中毒",
  "心脏骤停", "昏迷", "抽搐不止",
];

export interface SafetyCheckResult {
  safe: boolean;
  type?: "self_harm" | "emergency";
  message?: string;
}

export function checkSafety(question: string): SafetyCheckResult {
  const normalized = question.toLowerCase();

  for (const kw of SELF_HARM_KEYWORDS) {
    if (normalized.includes(kw)) {
      return {
        safe: false,
        type: "self_harm",
        message:
          "检测到您可能正在经历困难时刻。请立即联系专业帮助：\n\n" +
          "🆘 全国心理援助热线：400-161-9995\n" +
          "🆘 北京心理危机研究与干预中心：010-82951332\n" +
          "🆘 紧急情况请拨打 120\n\n" +
          "您并不孤单，专业人士可以帮助您。",
      };
    }
  }

  for (const kw of EMERGENCY_KEYWORDS) {
    if (normalized.includes(kw)) {
      return {
        safe: false,
        type: "emergency",
        message:
          "⚠️ 检测到您可能正在经历紧急医疗状况。\n\n" +
          "请立即拨打 120 或前往最近的医院急诊科！\n\n" +
          "本平台为经验交流平台，无法处理紧急医疗情况。",
      };
    }
  }

  return { safe: true };
}
