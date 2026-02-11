// HealthBrief to Consultation Integration
// Version: 1.0.0
// Bridges HealthBrief processing with the consultation orchestrator

import { randomUUID } from "crypto";
import { detectAnomaliesBatch } from "@/lib/anomaly/detector";
import { runConsultation, type ConsultationResult } from "@/lib/engine/orchestrator";
import { ConsultationEmitter } from "@/lib/engine/emitter";
import type {
  HealthBrief,
  HealthBriefInput,
  HealthBriefResult,
  HealthBriefMetric,
  HealthBriefStatus,
} from "./types";
import type { AnomalySeverity } from "@/lib/anomaly/types";
import { evaluateTriggerPolicy } from "./policy";
import { formatForConsultation } from "./formatter";

/**
 * Process a HealthBrief submission end-to-end:
 * 1. Run anomaly detection on all metrics
 * 2. Evaluate trigger policy
 * 3. Trigger consultation if policy allows
 * 4. Return result
 */
export async function processHealthBrief(
  input: HealthBriefInput,
  userPreference?: import("./types").UserTriggerPreference
): Promise<HealthBriefResult> {
  const briefId = randomUUID();
  const now = Date.now();

  // Initialize HealthBrief
  const brief: HealthBrief = {
    id: briefId,
    userId: input.userId,
    version: "1.0.0",
    status: "pending",
    metrics: input.metrics.map((m) => ({
      type: m.type,
      value: m.value,
      unit: m.unit,
      timestamp: m.timestamp ?? now,
      source: m.source ?? "manual",
      confidence: m.confidence ?? 1.0,
    })),
    context: {
      submittedAt: now,
      submitterUserAgent: "health-brief-processor/1.0.0",
      collectionMethod: input.context?.collectionMethod ?? "manual",
      notes: input.notes,
    },
    anomalies: [],
    maxSeverity: null,
    policyVersion: "v1",
    appliedPolicy: userPreference?.defaultPolicy ?? "anomaly_only",
    triggerDecision: {
      shouldTrigger: false,
      reason: "Processing",
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Step 1: Run anomaly detection
    const detectionInputs = brief.metrics.map((m) => ({
      metricType: m.type,
      value: m.value,
      unit: m.unit,
      timestamp: m.timestamp,
    }));

    const detectionResults = await detectAnomaliesBatch(
      input.userId,
      detectionInputs
    );

    // Aggregate anomalies
    brief.anomalies = detectionResults.flatMap((r) => r.anomalies);

    // Determine max severity
    if (brief.anomalies.length > 0) {
      const severityRank: Record<AnomalySeverity, number> = {
        mild: 1,
        moderate: 2,
        attention: 3,
      };
      brief.maxSeverity = brief.anomalies.reduce((max, a) => {
        if (!max) return a.severity;
        return severityRank[a.severity] > severityRank[max] ? a.severity : max;
      }, null as AnomalySeverity | null);
    }

    brief.status = "analyzed";
    brief.updatedAt = Date.now();

    // Step 2: Evaluate trigger policy
    const policyContext = {
      userId: input.userId,
      briefId,
      anomalies: brief.anomalies,
      maxSeverity: brief.maxSeverity,
      userPreference,
    };

    const policyResult = evaluateTriggerPolicy(policyContext);
    brief.triggerDecision = {
      shouldTrigger: policyResult.shouldTrigger,
      reason: policyResult.reason,
      triggeredAt: policyResult.shouldTrigger ? Date.now() : undefined,
    };

    // Step 3: Trigger consultation if policy allows
    let consultationResult: ConsultationResult | undefined;

    if (policyResult.shouldTrigger) {
      brief.status = "triggered";
      brief.updatedAt = Date.now();

      const formattedInput = formatForConsultation(brief);

      // Trigger consultation via orchestrator
      consultationResult = await runConsultationWithHealthBrief(
        input.userId,
        formattedInput
      );

      brief.consultationId = consultationResult.consultationId;
    } else {
      brief.status = "skipped";
      brief.updatedAt = Date.now();
    }

    // Return result
    return {
      briefId,
      status: brief.status,
      anomalies: brief.anomalies,
      maxSeverity: brief.maxSeverity,
      consultationTriggered: policyResult.shouldTrigger,
      consultationId: brief.consultationId,
      skipReason: policyResult.shouldTrigger ? undefined : policyResult.reason,
    };
  } catch (error) {
    brief.status = "failed";
    brief.updatedAt = Date.now();

    return {
      briefId,
      status: "failed",
      anomalies: brief.anomalies,
      maxSeverity: brief.maxSeverity,
      consultationTriggered: false,
      skipReason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run consultation with HealthBrief-formatted input
 * Wraps the core orchestrator with health-specific context
 */
async function runConsultationWithHealthBrief(
  userId: string,
  formattedInput: ReturnType<typeof formatForConsultation>
): Promise<ConsultationResult> {
  const emitter = new ConsultationEmitter();

  // Log health consultation start
  emitter.emit({
    type: "consultation:start",
    consultationId: "pending",
    question: formattedInput.question,
  });

  // Run consultation with formatted question
  const result = await runConsultation(
    userId,
    formattedInput.question,
    emitter
  );

  return result;
}

/**
 * Check if a brief should trigger without full processing
 * Useful for UI preview
 */
export function shouldTriggerConsultation(
  metrics: HealthBriefMetric[],
  userPreference?: import("./types").UserTriggerPreference
): {
  wouldTrigger: boolean;
  estimatedSeverity: AnomalySeverity | null;
  reason: string;
} {
  if (metrics.length === 0) {
    return {
      wouldTrigger: false,
      estimatedSeverity: null,
      reason: "No metrics provided",
    };
  }

  const policy = userPreference?.defaultPolicy ?? "anomaly_only";

  if (policy === "always") {
    return {
      wouldTrigger: true,
      estimatedSeverity: null,
      reason: "Always policy - would trigger on submission",
    };
  }

  if (policy === "user_opt_in" && !userPreference?.enabled) {
    return {
      wouldTrigger: false,
      estimatedSeverity: null,
      reason: "User has not opted in",
    };
  }

  return {
    wouldTrigger: false, // Cannot determine without actual detection
    estimatedSeverity: null,
    reason: "Requires anomaly detection - submit to check",
  };
}

/**
 * Re-export types for convenience
 */
export type {
  HealthBrief,
  HealthBriefInput,
  HealthBriefResult,
  FormattedConsultationInput,
} from "./types";

export { formatForConsultation } from "./formatter";
export { evaluateTriggerPolicy, getDefaultPolicy } from "./policy";
