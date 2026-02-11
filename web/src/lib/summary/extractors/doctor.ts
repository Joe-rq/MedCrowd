// Extract items that need doctor confirmation

import type { AgentResponseRecord } from "../types";

const DOCTOR_KEYWORDS = [
  "问医生", "咨询医生", "医生确认", "遵医嘱",
  "复查", "进一步检查", "确诊", "医生建议",
  "就医", "看医生", "去医院", "专业医生",
  "医疗机构", "诊断", "治疗方案",
];

export function extractDoctorConfirm(responses: AgentResponseRecord[]): string[] {
  const items: string[] = [];

  for (const r of responses) {
    if (!r.isValid) continue;
    const sentences = r.rawResponse.split(/[。！？\n]+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 5 || trimmed.length > 150) continue;
      if (DOCTOR_KEYWORDS.some((kw) => trimmed.includes(kw))) {
        items.push(trimmed);
      }
    }
  }

  const unique = [...new Set(items)].slice(0, 5);
  return unique.length === 0 ? ["具体诊断和治疗方案请咨询专业医生"] : unique;
}
