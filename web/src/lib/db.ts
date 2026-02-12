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
  // Health metrics exports
  addHealthMetric,
  addHealthMetricsBatch,
  getHealthMetrics,
  getHealthMetricsForWindow,
  saveWeeklyHealthSnapshot,
  getWeeklyHealthSnapshots,
  aggregateHealthToWeekly,
  getUserHealthMetricTypes,
  deleteUserHealthMetrics,
  checkHealthMetricsMigrationTriggers,
  // Consent operations
  getConsentRecord,
  checkConsent,
  grantConsent,
  revokeConsent,
  hasValidConsent,
  getConsentAuditEvents,
  logSyncBlocked,
  getWeekId,
  // Feedback operations
  submitFeedback,
  getFeedback,
  // Lock and event helpers
  acquireLock,
  releaseLock,
  pushEvent,
  getEvents,
} from "./db/index";

export type {
  UserRecord,
  ConsultationRecord,
  AgentResponseRecord,
  // Health metrics types
  HealthMetricType,
  HealthMetricPoint,
  WeeklySnapshot,
  HealthMetricsIndex,
  StorageLatencyMetrics,
  // Feedback types
  FeedbackRecord,
} from "./db/index";
