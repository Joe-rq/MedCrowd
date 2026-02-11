/**
 * Health Analytics Event Emitters
 * 
 * Decoupled event emission for health data engagement loop.
 * All emitters are no-ops by default until an analytics provider is configured.
 */

import type {
  HealthAnalyticsEvent,
  WeeklyReportOpenedEvent,
  AnomalyAlertViewedEvent,
  AlertReturnVisitEvent,
  HealthQuestionSubmittedEvent,
  ReportSharedEvent,
} from './events';

// Global event handler registry
let globalHandler: ((event: HealthAnalyticsEvent) => void) | null = null;

/**
 * Configure the global analytics handler
 * Call once at app initialization with your analytics provider
 */
export function configureAnalyticsHandler(
  handler: (event: HealthAnalyticsEvent) => void
): void {
  globalHandler = handler;
}

/**
 * Get the current analytics handler (for testing)
 */
export function getAnalyticsHandler(): typeof globalHandler {
  return globalHandler;
}

/**
 * Clear the analytics handler (for testing)
 */
export function clearAnalyticsHandler(): void {
  globalHandler = null;
}

/**
 * Core event emission function
 * Decoupled from business logic - safe to call anywhere
 */
function emitEvent(event: HealthAnalyticsEvent): void {
  if (typeof window === 'undefined') {
    // Server-side: events are silently dropped (no-op)
    // Future: could queue for batch processing
    return;
  }

  if (globalHandler) {
    try {
      globalHandler(event);
    } catch (err) {
      // Analytics failures must never break business logic
      console.error('[Analytics] Event emission failed:', err);
    }
  }
}

/**
 * Generate anonymized user ID from session
 * Uses simple hash to avoid PII in analytics
 */
function anonymizeUserId(userId: string): string {
  // Simple hash for anonymization
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `u_${Math.abs(hash).toString(36)}`;
}

/**
 * Get current timestamp in milliseconds
 */
function now(): number {
  return Date.now();
}

// ============================================================================
// Event Emitter Functions
// ============================================================================

export interface EmitWeeklyReportOpenedOptions {
  userId: string;
  reportId: string;
  hasAnomaly: boolean;
  consultationId?: string;
}

/**
 * Emit: User opened weekly health report
 * WAU Signal: Primary engagement indicator
 */
export function emitWeeklyReportOpened(
  options: EmitWeeklyReportOpenedOptions
): void {
  const event: WeeklyReportOpenedEvent = {
    type: 'health.weekly_report.opened',
    userId: anonymizeUserId(options.userId),
    timestamp: now(),
    reportId: options.reportId,
    hasAnomaly: options.hasAnomaly,
    consultationId: options.consultationId,
  };
  emitEvent(event);
}

export interface EmitAnomalyAlertViewedOptions {
  userId: string;
  alertId: string;
  severity: 'low' | 'medium' | 'high';
  metricType: string;
  consultationId?: string;
}

/**
 * Emit: User viewed anomaly alert details
 * WAU Signal: Strong engagement indicator
 */
export function emitAnomalyAlertViewed(
  options: EmitAnomalyAlertViewedOptions
): void {
  const event: AnomalyAlertViewedEvent = {
    type: 'health.anomaly_alert.viewed',
    userId: anonymizeUserId(options.userId),
    timestamp: now(),
    alertId: options.alertId,
    severity: options.severity,
    metricType: options.metricType,
    consultationId: options.consultationId,
  };
  emitEvent(event);
}

export interface EmitAlertReturnVisitOptions {
  userId: string;
  sourceAlertId: string;
  entryPoint: 'push' | 'email' | 'sms' | 'deep_link';
  timeSinceAlertMinutes: number;
}

/**
 * Emit: User returned via alert notification
 * WAU Signal: Reactivation indicator
 */
export function emitAlertReturnVisit(
  options: EmitAlertReturnVisitOptions
): void {
  const event: AlertReturnVisitEvent = {
    type: 'health.alert.return_visit',
    userId: anonymizeUserId(options.userId),
    timestamp: now(),
    sourceAlertId: options.sourceAlertId,
    entryPoint: options.entryPoint,
    timeSinceAlertMinutes: options.timeSinceAlertMinutes,
  };
  emitEvent(event);
}

export interface EmitHealthQuestionSubmittedOptions {
  userId: string;
  questionHash: string;
  questionLength: number;
  category: 'pre_visit' | 'during_visit' | 'post_visit' | 'medication' | 'mental' | 'general';
}

/**
 * Emit: User submitted a health question
 * WAU Signal: Core engagement
 */
export function emitHealthQuestionSubmitted(
  options: EmitHealthQuestionSubmittedOptions
): void {
  const event: HealthQuestionSubmittedEvent = {
    type: 'health.question.submitted',
    userId: anonymizeUserId(options.userId),
    timestamp: now(),
    questionHash: options.questionHash,
    questionLength: options.questionLength,
    category: options.category,
  };
  emitEvent(event);
}

export interface EmitReportSharedOptions {
  userId: string;
  reportId: string;
  shareChannel: 'copy_link' | 'wechat' | 'email' | 'other';
  consultationId: string;
}

/**
 * Emit: User shared a report
 * WAU Signal: Viral engagement
 */
export function emitReportShared(
  options: EmitReportSharedOptions
): void {
  const event: ReportSharedEvent = {
    type: 'health.report.shared',
    userId: anonymizeUserId(options.userId),
    timestamp: now(),
    reportId: options.reportId,
    shareChannel: options.shareChannel,
    consultationId: options.consultationId,
  };
  emitEvent(event);
}

// ============================================================================
// Convenience Hooks for React Components
// ============================================================================

import { useCallback } from 'react';

/**
 * React hook for report opened event
 */
export function useReportOpenedEmitter(userId: string) {
  return useCallback(
    (reportId: string, hasAnomaly: boolean, consultationId?: string) => {
      emitWeeklyReportOpened({
        userId,
        reportId,
        hasAnomaly,
        consultationId,
      });
    },
    [userId]
  );
}

/**
 * React hook for alert viewed event
 */
export function useAlertViewedEmitter(userId: string) {
  return useCallback(
    (
      alertId: string,
      severity: 'low' | 'medium' | 'high',
      metricType: string,
      consultationId?: string
    ) => {
      emitAnomalyAlertViewed({
        userId,
        alertId,
        severity,
        metricType,
        consultationId,
      });
    },
    [userId]
  );
}

/**
 * React hook for report shared event
 */
export function useReportSharedEmitter(userId: string) {
  return useCallback(
    (
      reportId: string,
      shareChannel: 'copy_link' | 'wechat' | 'email' | 'other',
      consultationId: string
    ) => {
      emitReportShared({
        userId,
        reportId,
        shareChannel,
        consultationId,
      });
    },
    [userId]
  );
}
