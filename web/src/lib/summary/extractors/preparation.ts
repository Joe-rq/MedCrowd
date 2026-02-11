// Extract preparation/checklist items from responses

import type { AgentResponseRecord } from "../types";

const PREPARATION_MARKERS = [
  "空腹", "带上", "携带", "提前", "注意", "记得", "准备", "不要吃", "停用",
];

export function extractPreparation(responses: AgentResponseRecord[]): string[] {
  const items: string[] = [];

  for (const r of responses) {
    if (!r.isValid) continue;
    const sentences = r.rawResponse.split(/[。！？\n]+/);
    for (const s of sentences) {
      if (PREPARATION_MARKERS.some((m) => s.includes(m))) {
        const trimmed = s.trim();
        if (trimmed.length > 5 && trimmed.length < 100) {
          items.push(trimmed);
        }
      }
    }
  }

  return [...new Set(items)].slice(0, 8);
}
