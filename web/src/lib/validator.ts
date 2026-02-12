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

/** Generate character bigrams from text */
function bigrams(text: string): Set<string> {
  const normalized = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

/** Jaccard similarity between two bigram sets */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

const DEDUP_THRESHOLD = 0.7;

// Bigram Jaccard dedup: catches reordered text, added filler words, etc.
export function isDuplicate(newText: string, existingTexts: string[]): boolean {
  const newBigrams = bigrams(newText.trim());
  for (const existing of existingTexts) {
    const existingBigrams = bigrams(existing.trim());
    if (jaccardSimilarity(newBigrams, existingBigrams) >= DEDUP_THRESHOLD) {
      return true;
    }
  }
  return false;
}
