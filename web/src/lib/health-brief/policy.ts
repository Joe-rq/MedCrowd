// HealthBrief Trigger Policy Engine
// Version: 1.0.0
// Default policy: "anomaly_only" with override strategy

import type {
  TriggerPolicy,
  PolicyVersion,
  PolicyConfig,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  UserTriggerPreference,
} from "./types";
import type { AnomalySeverity } from "@/lib/anomaly/types";

// Policy version configuration
const POLICY_VERSION: PolicyVersion = "v1";

// V1 Default policy configuration
export const V1_POLICY_CONFIG: PolicyConfig = {
  version: POLICY_VERSION,
  defaultPolicy: "anomaly_only",
  anomalyThreshold: "moderate",
  cooldownMs: 24 * 60 * 60 * 1000, // 24 hours between consultations
  maxMetricsPerBrief: 10,
  requireUserConsent: false, // V1: automatic trigger based on policy
};

// Severity ranking for comparison
const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  mild: 1,
  moderate: 2,
  attention: 3,
};

/**
 * Check if severity meets or exceeds threshold
 */
function meetsSeverityThreshold(
  severity: AnomalySeverity | null,
  threshold: AnomalySeverity
): boolean {
  if (!severity) return false;
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];
}

/**
 * Check if enough time has passed since last consultation
 */
function isPastCooldown(
  lastConsultationAt: number | undefined,
  cooldownMs: number
): boolean {
  if (!lastConsultationAt) return true;
  const now = Date.now();
  return now - lastConsultationAt >= cooldownMs;
}

/**
 * Evaluate "always" policy - trigger on every brief
 */
function evaluateAlwaysPolicy(
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  const pastCooldown = isPastCooldown(
    context.lastConsultationAt,
    V1_POLICY_CONFIG.cooldownMs
  );

  if (!pastCooldown) {
    return {
      shouldTrigger: false,
      policy: "always",
      reason: "Cooldown period active since last consultation",
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  return {
    shouldTrigger: true,
    policy: "always",
    reason: "Always policy active - triggering consultation",
    severity: context.maxSeverity,
    appliedAt: Date.now(),
  };
}

/**
 * Evaluate "anomaly_only" policy - trigger only on moderate+ anomalies
 * This is the V1 default policy
 */
function evaluateAnomalyOnlyPolicy(
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  // Check user preference for override threshold
  const threshold =
    context.userPreference?.overrideSeverity ??
    V1_POLICY_CONFIG.anomalyThreshold;

  const pastCooldown = isPastCooldown(
    context.lastConsultationAt,
    V1_POLICY_CONFIG.cooldownMs
  );

  if (!pastCooldown) {
    return {
      shouldTrigger: false,
      policy: "anomaly_only",
      reason: "Cooldown period active since last consultation",
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  const hasSignificantAnomaly = meetsSeverityThreshold(
    context.maxSeverity,
    threshold
  );

  if (!hasSignificantAnomaly) {
    return {
      shouldTrigger: false,
      policy: "anomaly_only",
      reason: `No anomalies meet severity threshold (${threshold})`,
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  return {
    shouldTrigger: true,
    policy: "anomaly_only",
    reason: `Anomaly detected with severity: ${context.maxSeverity}`,
    severity: context.maxSeverity,
    appliedAt: Date.now(),
  };
}

/**
 * Evaluate "user_opt_in" policy - only trigger with explicit consent
 */
function evaluateUserOptInPolicy(
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  // For V1, user_opt_in requires the user preference to explicitly enable triggers
  const userEnabled = context.userPreference?.enabled ?? false;

  if (!userEnabled) {
    return {
      shouldTrigger: false,
      policy: "user_opt_in",
      reason: "User has not opted in to automatic consultations",
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  const pastCooldown = isPastCooldown(
    context.lastConsultationAt,
    V1_POLICY_CONFIG.cooldownMs
  );

  if (!pastCooldown) {
    return {
      shouldTrigger: false,
      policy: "user_opt_in",
      reason: "Cooldown period active since last consultation",
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  // With user opt-in, we still respect anomaly threshold unless overridden
  const threshold =
    context.userPreference?.overrideSeverity ??
    V1_POLICY_CONFIG.anomalyThreshold;
  const hasSignificantAnomaly = meetsSeverityThreshold(
    context.maxSeverity,
    threshold
  );

  if (!hasSignificantAnomaly) {
    return {
      shouldTrigger: false,
      policy: "user_opt_in",
      reason: `No anomalies meet severity threshold (${threshold})`,
      severity: context.maxSeverity,
      appliedAt: Date.now(),
    };
  }

  return {
    shouldTrigger: true,
    policy: "user_opt_in",
    reason: `User opted in and anomaly detected: ${context.maxSeverity}`,
    severity: context.maxSeverity,
    appliedAt: Date.now(),
  };
}

/**
 * Main policy evaluation function
 * Routes to appropriate policy evaluator based on configuration
 */
export function evaluateTriggerPolicy(
  context: PolicyEvaluationContext,
  policyOverride?: TriggerPolicy
): PolicyEvaluationResult {
  const policy =
    policyOverride ??
    context.userPreference?.defaultPolicy ??
    V1_POLICY_CONFIG.defaultPolicy;

  switch (policy) {
    case "always":
      return evaluateAlwaysPolicy(context);
    case "anomaly_only":
      return evaluateAnomalyOnlyPolicy(context);
    case "user_opt_in":
      return evaluateUserOptInPolicy(context);
    default:
      // Fallback to anomaly_only for unknown policies
      return {
        shouldTrigger: false,
        policy: "anomaly_only",
        reason: `Unknown policy "${policy}" - defaulting to anomaly_only with no trigger`,
        severity: context.maxSeverity,
        appliedAt: Date.now(),
      };
  }
}

/**
 * Get current policy configuration
 */
export function getPolicyConfig(): PolicyConfig {
  return { ...V1_POLICY_CONFIG };
}

/**
 * Get the default policy for V1
 */
export function getDefaultPolicy(): TriggerPolicy {
  return V1_POLICY_CONFIG.defaultPolicy;
}

/**
 * Check if a severity level would trigger consultation under current policy
 * Utility for UI previews
 */
export function wouldTriggerAtSeverity(
  severity: AnomalySeverity | null,
  userPreference?: UserTriggerPreference
): boolean {
  const threshold =
    userPreference?.overrideSeverity ?? V1_POLICY_CONFIG.anomalyThreshold;
  return meetsSeverityThreshold(severity, threshold);
}

/**
 * Get human-readable policy description
 */
export function getPolicyDescription(policy: TriggerPolicy): string {
  const descriptions: Record<TriggerPolicy, string> = {
    always:
      "始终触发咨询：每次提交健康简报时都会自动发起多智能体咨询",
    anomaly_only:
      "异常时触发：仅当检测到中等或以上严重程度的异常时才发起咨询（默认）",
    user_opt_in:
      "用户确认触发：仅在用户明确选择加入且检测到异常时才发起咨询",
  };
  return descriptions[policy];
}

/**
 * Get severity threshold description
 */
export function getSeverityThresholdDescription(
  severity: AnomalySeverity
): string {
  const descriptions: Record<AnomalySeverity, string> = {
    mild: "轻微（检测到任何数据变化即触发）",
    moderate: "中等（检测到中度异常时触发 - 默认）",
    attention: "关注（仅在检测到显著异常时触发）",
  };
  return descriptions[severity];
}
