// Summary types and extractor interface

import type { AgentResponseRecord } from "../db/types";

export type { AgentResponseRecord } from "../db/types";

export interface ReportSummary {
  consensus: { point: string; agentCount: number; totalAgents: number }[];
  divergence: { pointA: string; pointB: string; splitRatio: string }[];
  preparation: string[];
  needDoctorConfirm: string[];
  costRange?: { min: number; max: number; note: string };
  riskWarning: string;
  agentResponses: { agentId: string; summary: string; keyPoints: string[] }[];
  noExperienceCount: number;
  totalAgentsQueried: number;
  reactionHighlights?: { agentId: string; reaction: string; references: string[] }[];
}

export interface Extractor<T> {
  name: string;
  extract(responses: AgentResponseRecord[]): T;
}
