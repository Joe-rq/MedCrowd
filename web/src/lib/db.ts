// Re-export from modular db layer for backward compatibility
export {
  upsertUser,
  getUserById,
  getUserBySecondmeId,
  getConsultableUsers,
  circuitBreakUser,
  updateUserTokens,
  createConsultation,
  getConsultation,
  updateConsultation,
  getUserConsultations,
  addAgentResponse,
  addAgentResponsesBatch,
  getAgentResponses,
  checkDBHealth,
  getDBMode,
  resetJSONCache,
} from "./db/index";

export type {
  UserRecord,
  ConsultationRecord,
  AgentResponseRecord,
} from "./db/index";
