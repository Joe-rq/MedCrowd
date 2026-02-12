// High-risk keyword detection for medical safety
// Uses pattern-based matching for better coverage of paraphrased expressions

// --- Self-harm patterns ---
// Exact keywords (fast path)
const SELF_HARM_EXACT = [
  "自杀", "自残", "割腕", "跳楼", "轻生", "上吊", "服毒",
  "割脉", "烧炭", "跳河", "跳桥", "吞药", "安乐死",
];

// Regex patterns for fuzzy/paraphrased expressions
const SELF_HARM_PATTERNS = [
  /不\s*想\s*活/, /想\s*死/, /想.*结束.*生命/, /活.*没.*意[思义]/,
  /撑\s*不\s*下\s*去/, /不想.*继续/, /了\s*结/, /寻\s*短\s*见/,
  /厌\s*世/, /生无可恋/, /一了百了/, /解脱.*痛苦/,
  /吃.*安眠药/, /过量.*服[用药]/, /割.*手腕/,
  /suicide/i, /kill\s*my\s*self/i, /end\s*my\s*life/i,
  /self[- ]?harm/i, /want\s*to\s*die/i, /don'?t\s*want\s*to\s*live/i,
];

// --- Emergency patterns ---
const EMERGENCY_EXACT = [
  "胸口剧痛", "呼吸困难", "大量出血", "意识模糊", "中毒",
  "心脏骤停", "昏迷", "抽搐不止", "窒息", "休克",
  "心肌梗", "脑出血", "脑梗", "过敏性休克", "气道阻塞",
  "心跳停止", "瞳孔放大", "口吐白沫",
];

const EMERGENCY_PATTERNS = [
  /突然.*(?:倒地|晕倒|失去意识)/, /(?:剧烈|突发).*(?:胸痛|头痛)/,
  /(?:喘不[上过]|透不过).*气/, /(?:大量|止不住).*(?:出血|流血)/,
  /(?:吞|误食|误服).*(?:异物|毒|药)/, /(?:触电|溺水|烫伤)/,
  /chest\s*pain/i, /can'?t\s*breathe/i, /heart\s*attack/i,
  /stroke/i, /seizure/i, /unconscious/i, /choking/i,
  /severe\s*(?:bleeding|pain)/i, /overdose/i,
];

export interface SafetyCheckResult {
  safe: boolean;
  type?: "self_harm" | "emergency";
  message?: string;
}

function matchesAny(
  text: string,
  exactKeywords: string[],
  patterns: RegExp[]
): boolean {
  // Strip common evasion characters (spaces, dots, asterisks between chars)
  const stripped = text.replace(/[\s.*·•_\-]+/g, "");
  for (const kw of exactKeywords) {
    if (stripped.includes(kw)) return true;
  }
  // Patterns run against original text (they handle spacing themselves)
  for (const pattern of patterns) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function checkSafety(question: string): SafetyCheckResult {
  const normalized = question.toLowerCase();

  if (matchesAny(normalized, SELF_HARM_EXACT, SELF_HARM_PATTERNS)) {
    return {
      safe: false,
      type: "self_harm",
      message:
        "检测到您可能正在经历困难时刻。请立即联系专业帮助：\n\n" +
        "全国心理援助热线：400-161-9995\n" +
        "北京心理危机研究与干预中心：010-82951332\n" +
        "生命热线：400-821-1215\n" +
        "紧急情况请拨打 120\n\n" +
        "您并不孤单，专业人士可以帮助您。",
    };
  }

  if (matchesAny(normalized, EMERGENCY_EXACT, EMERGENCY_PATTERNS)) {
    return {
      safe: false,
      type: "emergency",
      message:
        "检测到您可能正在经历紧急医疗状况。\n\n" +
        "请立即拨打 120 或前往最近的医院急诊科！\n\n" +
        "本平台为经验交流平台，无法处理紧急医疗情况。",
    };
  }

  return { safe: true };
}
