// LLM-based report summarizer using SecondMe Chat API

import type { AgentResponseRecord, ReportSummary } from "./types";
import { chatWithAgent } from "@/lib/secondme";

const LLM_SUMMARY_ENABLED = process.env.LLM_SUMMARY_ENABLED === "true";
const LLM_TIMEOUT_MS = 15_000;

const SUMMARIZER_SYSTEM_PROMPT = `你是一个医疗健康咨询摘要分析师。你的任务是分析多位用户 AI 代理对同一健康问题的回复，提取结构化摘要。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "consensus": [
    { "point": "共识要点描述", "agentCount": 同意的代理数, "totalAgents": 总代理数 }
  ],
  "divergence": [
    { "pointA": "观点A", "pointB": "观点B", "splitRatio": "比例如 2:1" }
  ],
  "preparation": ["就医准备建议1", "就医准备建议2"],
  "needDoctorConfirm": ["需要医生确认的事项"],
  "costRange": { "min": 最低费用数字, "max": 最高费用数字, "note": "费用说明" }
}

规则：
- consensus: 提取 ≥2 个代理提到的共同建议，按提及频率排序
- divergence: 提取代理之间的分歧观点，如果没有分歧则为空数组
- preparation: 提取就医前的准备事项（如空腹、带病历等）
- needDoctorConfirm: 提取需要专业医生确认的事项
- costRange: 如果有费用相关信息则提取，没有则设为 null
- 只输出 JSON，不要有任何前缀或后缀文字`;

function buildUserMessage(question: string, responses: AgentResponseRecord[]): string {
  const validResponses = responses.filter((r) => r.isValid);
  const responsesText = validResponses
    .map((r, i) => `【代理 ${i + 1}】\n${r.rawResponse}`)
    .join("\n\n");

  return `用户问题：${question}\n\n以下是 ${validResponses.length} 位代理的回复：\n\n${responsesText}`;
}

interface LLMSummaryFields {
  consensus: ReportSummary["consensus"];
  divergence: ReportSummary["divergence"];
  preparation: ReportSummary["preparation"];
  needDoctorConfirm: ReportSummary["needDoctorConfirm"];
  costRange?: ReportSummary["costRange"];
}

function parseLLMResponse(text: string): LLMSummaryFields | null {
  // Try to extract JSON from the response (may have markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!Array.isArray(parsed.consensus) || !Array.isArray(parsed.preparation)) {
    return null;
  }

  return {
    consensus: parsed.consensus ?? [],
    divergence: parsed.divergence ?? [],
    preparation: parsed.preparation ?? [],
    needDoctorConfirm: parsed.needDoctorConfirm ?? [],
    costRange: parsed.costRange ?? undefined,
  };
}

export async function llmSummarize(
  responses: AgentResponseRecord[],
  question: string,
  askerAccessToken: string
): Promise<LLMSummaryFields | null> {
  if (!LLM_SUMMARY_ENABLED) return null;

  const validResponses = responses.filter((r) => r.isValid);
  if (validResponses.length === 0) return null;

  try {
    const message = buildUserMessage(question, responses);

    const result = await Promise.race([
      chatWithAgent(askerAccessToken, message, SUMMARIZER_SYSTEM_PROMPT),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM summarize timeout")), LLM_TIMEOUT_MS)
      ),
    ]);

    return parseLLMResponse(result.text);
  } catch (err) {
    console.warn("[LLM Summarizer] Failed, falling back to rule engine:", err);
    return null;
  }
}
