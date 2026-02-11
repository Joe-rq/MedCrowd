// Engine module public API

export { runConsultation, type ConsultationResult } from "./orchestrator";
export type { ReportSummary } from "../summary";
export type { ConsultationEvent } from "./events";
export { ConsultationEmitter, createEmitter } from "./emitter";
