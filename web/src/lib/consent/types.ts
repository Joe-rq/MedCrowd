// Health data consent types and audit trail definitions

/**
 * Consent state for health data sync
 * - NONE: User has not yet given consent
 * - GRANTED: User has actively granted consent
 * - REVOKED: User has revoked consent (sync blocked)
 */
export type ConsentStatus = "NONE" | "GRANTED" | "REVOKED";

/**
 * Audit event types for consent lifecycle tracking
 */
export type ConsentEventType =
  | "CONSENT_GRANTED"
  | "CONSENT_REVOKED"
  | "SYNC_BLOCKED"
  | "DATA_DELETED"
  | "RETENTION_POLICY_APPLIED";

/**
 * Data scope covered by consent
 */
export interface ConsentScope {
  metrics: string[]; // e.g., ["weight", "heartRate", "sleep"]
  sources: string[]; // e.g., ["apple_health", "manual_entry"]
  purpose: "health_consultation" | "anomaly_detection" | "reporting";
}

/**
 * Consent record stored per user
 */
export interface ConsentRecord {
  userId: string;
  status: ConsentStatus;
  grantedAt?: number; // Unix timestamp ms
  revokedAt?: number; // Unix timestamp ms
  expiresAt?: number; // Unix timestamp ms (optional expiration)
  scope: ConsentScope;
  version: string; // Consent terms version (e.g., "v1.0")
  ipAddress?: string; // IP at time of consent (privacy consideration)
  userAgent?: string; // User agent at time of consent
}

/**
 * Audit trail entry for consent events
 */
export interface ConsentAuditEvent {
  id: string;
  userId: string;
  eventType: ConsentEventType;
  timestamp: number; // Unix timestamp ms
  details: {
    previousStatus?: ConsentStatus;
    newStatus?: ConsentStatus;
    scope?: ConsentScope;
    version?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    triggeredByRevocation?: boolean;
  };
  ipAddress?: string;
  userAgent?: string;
}

/**
 * API response for consent status
 */
export interface ConsentStatusResponse {
  hasConsent: boolean;
  status: ConsentStatus;
  grantedAt?: number;
  revokedAt?: number;
  expiresAt?: number;
  scope?: ConsentScope;
  version?: string;
}

/**
 * Request to grant consent
 */
export interface GrantConsentRequest {
  scope: ConsentScope;
  version: string;
  acknowledgedTerms: boolean;
}

/**
 * Request to revoke consent
 */
export interface RevokeConsentRequest {
  reason?: string;
  deleteData: boolean; // Whether to trigger data deletion
}

/**
 * Consent check result for internal use
 */
export interface ConsentCheckResult {
  allowed: boolean;
  reason?: string;
  record?: ConsentRecord;
}
