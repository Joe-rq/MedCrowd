// Consultation event types for engine orchestration

import type { ReportSummary } from "../summary";

export type ConsultationEvent =
  | { type: "consultation:start"; consultationId: string; question: string }
  | { type: "agent:query_start"; agentId: string; round: "initial" | "reaction" }
  | { type: "agent:response"; agentId: string; round: "initial" | "reaction"; latencyMs: number }
  | { type: "agent:error"; agentId: string; error: string }
  | { type: "validation:complete"; validCount: number; totalCount: number }
  | { type: "reaction:start"; triggerCount: number }
  | { type: "reaction:complete"; responseCount: number }
  | { type: "summary:ready"; report: ReportSummary }
  | { type: "consultation:done"; status: "DONE" | "PARTIAL" | "FAILED" };
