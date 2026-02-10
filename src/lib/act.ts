// SecondMe Act API - structured health question triage

import { getRequiredEnvVar } from "./secondme";

export type TriageIntent =
  | "experience_sharing"
  | "emergency"
  | "general_consultation"
  | "medication_related";

export interface TriageResult {
  intent: TriageIntent;
  confidence: number;
  suggestion: string;
}

const ACT_SYSTEM_PROMPT = `你是一个健康问题分诊 AI。请分析用户的健康咨询问题，返回严格的 JSON 格式分类结果。

分类规则：
- experience_sharing: 用户想了解他人经验（如"做胃镜什么感受""体检要注意什么"）
- emergency: 涉及紧急或严重症状（如"突然胸痛""大量出血""呼吸困难"）
- general_consultation: 一般性健康咨询（如"最近总是头疼""睡眠不好怎么办"）
- medication_related: 涉及药物使用（如"感冒药能和消炎药一起吃吗""这个药的副作用"）

返回格式（仅返回 JSON，不要其他文字）：
{"intent":"分类","confidence":0.85,"suggestion":"一句话建议"}`;

const INTENT_PROMPT_ADJUSTMENTS: Record<TriageIntent, string> = {
  experience_sharing: "\n请特别关注分享具体经历和流程细节。",
  emergency: "\n注意：这可能是紧急情况。请优先建议就医，同时分享相关经验。",
  general_consultation: "",
  medication_related: "\n请特别注意：不要给出具体用药建议，只分享一般性的经验。",
};

// Call SecondMe Act API for structured triage
export async function triageHealthQuestion(
  question: string
): Promise<TriageResult> {
  const apiBase = getRequiredEnvVar("SECONDME_API_BASE_URL");

  // Try to get an access token from any available user for act API
  // For triage, we use a direct API call without user context
  try {
    const res = await fetch(`${apiBase}/api/secondme/act`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        systemPrompt: ACT_SYSTEM_PROMPT,
        responseFormat: "json",
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && json.data) {
        return parseTriageResponse(json.data);
      }
    }
  } catch (err) {
    console.error("[Act] SecondMe API call failed, using fallback:", err);
  }

  // Fallback: rule-based classification
  return fallbackTriage(question);
}

function parseTriageResponse(data: unknown): TriageResult {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return validateTriageResult(parsed);
    } catch {
      // Not valid JSON
    }
  }

  if (typeof data === "object" && data !== null) {
    return validateTriageResult(data as Record<string, unknown>);
  }

  return fallbackTriage("");
}

function validateTriageResult(obj: Record<string, unknown>): TriageResult {
  const validIntents: TriageIntent[] = [
    "experience_sharing", "emergency", "general_consultation", "medication_related",
  ];

  const intent = validIntents.includes(obj.intent as TriageIntent)
    ? (obj.intent as TriageIntent)
    : "general_consultation";

  const confidence = typeof obj.confidence === "number"
    ? Math.max(0, Math.min(1, obj.confidence))
    : 0.5;

  const suggestion = typeof obj.suggestion === "string"
    ? obj.suggestion.slice(0, 200)
    : "建议咨询多位 AI 获取不同视角的经验分享";

  return { intent, confidence, suggestion };
}

// Rule-based fallback when Act API is unavailable
function fallbackTriage(question: string): TriageResult {
  const q = question.toLowerCase();

  const emergencyKeywords = [
    "急", "突然", "出血", "胸痛", "呼吸困难", "晕倒", "剧烈",
  ];
  const medicationKeywords = [
    "药", "用药", "吃药", "副作用", "服用", "处方", "消炎",
  ];
  const experienceKeywords = [
    "什么感受", "什么流程", "经历", "体验", "做过", "去过",
  ];

  if (emergencyKeywords.some((k) => q.includes(k))) {
    return {
      intent: "emergency",
      confidence: 0.7,
      suggestion: "检测到可能的紧急症状，建议优先前往医院就诊",
    };
  }

  if (medicationKeywords.some((k) => q.includes(k))) {
    return {
      intent: "medication_related",
      confidence: 0.7,
      suggestion: "用药问题建议咨询专业药师或医生",
    };
  }

  if (experienceKeywords.some((k) => q.includes(k))) {
    return {
      intent: "experience_sharing",
      confidence: 0.7,
      suggestion: "将为你收集他人的相关经验",
    };
  }

  return {
    intent: "general_consultation",
    confidence: 0.5,
    suggestion: "将为你咨询多位 AI 获取不同视角的建议",
  };
}

// Adjust system prompt based on triage result
export function getAdjustedSystemPrompt(
  basePrompt: string,
  triage: TriageResult
): string {
  const adjustment = INTENT_PROMPT_ADJUSTMENTS[triage.intent];
  return adjustment ? basePrompt + adjustment : basePrompt;
}
