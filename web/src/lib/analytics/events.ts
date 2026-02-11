/**
 * Analytics Event Types for MedCrowd Health Data Loop
 * 
 * Design Principles:
 * - Events are pure data structures (no side effects)
 * - No PII in event payloads (userId is hashed/anonymized)
 * - Timestamp is always Unix epoch in milliseconds
 * - Event emission is decoupled from business logic
 */

// Base event interface - all events extend this
export interface BaseAnalyticsEvent {
  type: string;
  userId: string;        // Anonymized user identifier (hashed)
  timestamp: number;     // Unix epoch in milliseconds
  sessionId?: string;    // Optional session identifier
}

// Engagement Loop Events
// Used for WAU (Weekly Active Users) calculation

/**
 * Fired when user opens their weekly health report
 * WAU Signal: Yes (primary engagement indicator)
 */
export interface WeeklyReportOpenedEvent extends BaseAnalyticsEvent {
  type: 'health.weekly_report.opened';
  reportId: string;           // Unique report identifier
  hasAnomaly: boolean;        // Whether report contains anomaly alerts
  consultationId?: string;    // Optional link to consultation
}

/**
 * Fired when user views an anomaly alert detail
 * WAU Signal: Yes (strong engagement indicator)
 */
export interface AnomalyAlertViewedEvent extends BaseAnalyticsEvent {
  type: 'health.anomaly_alert.viewed';
  alertId: string;            // Unique alert identifier
  severity: 'low' | 'medium' | 'high';
  metricType: string;         // e.g., 'heart_rate', 'sleep', 'steps'
  consultationId?: string;    // Optional link to consultation
}

/**
 * Fired when user returns to app after clicking alert notification
 * WAU Signal: Yes (reactivation indicator)
 * Attribution: sourceAlertId links to the triggering alert
 */
export interface AlertReturnVisitEvent extends BaseAnalyticsEvent {
  type: 'health.alert.return_visit';
  sourceAlertId: string;      // The alert that triggered the return
  entryPoint: 'push' | 'email' | 'sms' | 'deep_link';
  timeSinceAlertMinutes: number;  // Time elapsed since alert sent
}

// Additional Health Engagement Events

/**
 * Fired when user submits a health question
 * WAU Signal: Yes (core engagement)
 */
export interface HealthQuestionSubmittedEvent extends BaseAnalyticsEvent {
  type: 'health.question.submitted';
  questionHash: string;       // Hashed question content (no PII)
  questionLength: number;     // Character count
  category: 'pre_visit' | 'during_visit' | 'post_visit' | 'medication' | 'mental' | 'general';
}

/**
 * Fired when user shares a report
 * WAU Signal: Yes (viral engagement)
 */
export interface ReportSharedEvent extends BaseAnalyticsEvent {
  type: 'health.report.shared';
  reportId: string;
  shareChannel: 'copy_link' | 'wechat' | 'email' | 'other';
  consultationId: string;
}

// Union type of all health analytics events
export type HealthAnalyticsEvent =
  | WeeklyReportOpenedEvent
  | AnomalyAlertViewedEvent
  | AlertReturnVisitEvent
  | HealthQuestionSubmittedEvent
  | ReportSharedEvent;

// Event type constants for type-safe usage
export const HealthEventTypes = {
  WEEKLY_REPORT_OPENED: 'health.weekly_report.opened' as const,
  ANOMALY_ALERT_VIEWED: 'health.anomaly_alert.viewed' as const,
  ALERT_RETURN_VISIT: 'health.alert.return_visit' as const,
  HEALTH_QUESTION_SUBMITTED: 'health.question.submitted' as const,
  REPORT_SHARED: 'health.report.shared' as const,
};

// Type guard functions
export function isWeeklyReportOpenedEvent(event: HealthAnalyticsEvent): event is WeeklyReportOpenedEvent {
  return event.type === HealthEventTypes.WEEKLY_REPORT_OPENED;
}

export function isAnomalyAlertViewedEvent(event: HealthAnalyticsEvent): event is AnomalyAlertViewedEvent {
  return event.type === HealthEventTypes.ANOMALY_ALERT_VIEWED;
}

export function isAlertReturnVisitEvent(event: HealthAnalyticsEvent): event is AlertReturnVisitEvent {
  return event.type === HealthEventTypes.ALERT_RETURN_VISIT;
}

// WAU-eligible event types
export const WAU_EVENT_TYPES: readonly string[] = [
  HealthEventTypes.WEEKLY_REPORT_OPENED,
  HealthEventTypes.ANOMALY_ALERT_VIEWED,
  HealthEventTypes.ALERT_RETURN_VISIT,
  HealthEventTypes.HEALTH_QUESTION_SUBMITTED,
  HealthEventTypes.REPORT_SHARED,
] as const;

/**
 * Check if an event counts toward WAU calculation
 */
export function isWAUEvent(eventType: string): boolean {
  return WAU_EVENT_TYPES.includes(eventType);
}
