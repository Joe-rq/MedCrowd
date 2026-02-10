// Validate and filter agent responses

const NO_EXPERIENCE_MARKERS = [
  "我没有相关经历",
  "我不了解",
  "无法回答",
  "我没有这方面的经验",
  "没有相关的经历",
  "不太了解这方面",
];

const EMPTY_ADVICE_MARKERS = [
  "建议去医院",
  "请咨询专业医生",
  "建议看医生",
  "请去正规医院",
];

export interface ValidationResult {
  isValid: boolean;
  isNoExperience: boolean; // Keep in responses but exclude from consensus
  reason?: string;
}

export function validateResponse(text: string): ValidationResult {
  const trimmed = text.trim();

  // Rule 1: Too short
  if (trimmed.length < 20) {
    return { isValid: false, isNoExperience: false, reason: "回复过短（少于20字）" };
  }

  // Rule 2: No experience markers - keep but flag
  for (const marker of NO_EXPERIENCE_MARKERS) {
    if (trimmed.includes(marker)) {
      return { isValid: true, isNoExperience: true, reason: "无相关经历" };
    }
  }

  // Rule 3: Pure boilerplate advice with no substance
  const hasOnlyBoilerplate = EMPTY_ADVICE_MARKERS.some((m) => trimmed.includes(m));
  if (hasOnlyBoilerplate && trimmed.length < 60) {
    return { isValid: false, isNoExperience: false, reason: "纯套话无实质内容" };
  }

  return { isValid: true, isNoExperience: false };
}

// Simple dedup: check if response is >90% similar to any existing one
export function isDuplicate(newText: string, existingTexts: string[]): boolean {
  const normalized = newText.trim().replace(/\s+/g, "");
  for (const existing of existingTexts) {
    const existingNorm = existing.trim().replace(/\s+/g, "");
    const shorter = Math.min(normalized.length, existingNorm.length);
    const longer = Math.max(normalized.length, existingNorm.length);
    if (shorter === 0) continue;

    // Simple character overlap check
    let matches = 0;
    for (let i = 0; i < shorter; i++) {
      if (normalized[i] === existingNorm[i]) matches++;
    }
    if (matches / longer > 0.9) return true;
  }
  return false;
}
