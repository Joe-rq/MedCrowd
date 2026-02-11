# HealthBrief Contract Documentation

## Version: 1.0.0

The HealthBrief contract defines the structured health data representation and consultation trigger policy for anomaly handoff from health metrics to the MedCrowd consultation system.

---

## Overview

HealthBrief enables automatic consultation triggering when health anomalies are detected. It provides:

1. **Structured health data capture** - Standardized metric snapshots
2. **Anomaly detection integration** - Leverages existing anomaly detection system
3. **Configurable trigger policies** - Three policy modes with user overrides
4. **Consultation orchestration bridge** - Seamless handoff to multi-agent consultation

---

## Core Concepts

### HealthBrief

A snapshot of health metrics submitted for anomaly analysis and potential consultation triggering.

```typescript
interface HealthBrief {
  id: string;                    // UUID
  userId: string;                // MedCrowd user ID
  version: "1.0.0";
  status: HealthBriefStatus;     // pending | analyzed | triggered | skipped | failed
  metrics: HealthBriefMetric[];  // Array of health metric readings
  anomalies: Anomaly[];          // Detected anomalies (populated after analysis)
  maxSeverity: AnomalySeverity | null;
  appliedPolicy: TriggerPolicy;  // Policy used for this brief
  triggerDecision: {
    shouldTrigger: boolean;
    reason: string;
    triggeredAt?: number;
  };
  consultationId?: string;       // Reference if consultation triggered
  createdAt: number;
  updatedAt: number;
}
```

### Trigger Policies

Three policy modes control when consultations are triggered:

| Policy | Description | Use Case |
|--------|-------------|----------|
| `always` | Trigger on every HealthBrief submission | Continuous monitoring scenarios |
| `anomaly_only` | Trigger only when moderate+ anomaly detected | **V1 Default** - Standard health tracking |
| `user_opt_in` | Trigger only with explicit user consent | Privacy-sensitive deployments |

---

## V1 Default Configuration

### Default Policy: `anomaly_only`

The V1 default policy is `anomaly_only` with the following behavior:

- **Trigger threshold**: Moderate or higher severity anomalies
- **Cooldown period**: 24 hours between consultations
- **Max metrics per brief**: 10
- **User consent**: Not required (automatic based on policy)

### Override Strategy

Users can customize trigger behavior:

```typescript
interface UserTriggerPreference {
  userId: string;
  defaultPolicy: TriggerPolicy;      // Override system default
  overrideSeverity: AnomalySeverity | null; // Override threshold
  enabled: boolean;                  // Enable/disable triggers
  updatedAt: number;
}
```

Override hierarchy (highest to lowest):
1. Runtime policy override (in `processHealthBrief` call)
2. User preference default policy
3. System V1 default (`anomaly_only`)

---

## Workflow

### 1. Submission

```typescript
const result = await processHealthBrief({
  userId: "user-123",
  metrics: [
    { type: "weight", value: 75.5, unit: "kg", timestamp: Date.now() },
    { type: "heartRate", value: 95, unit: "bpm", timestamp: Date.now() }
  ],
  notes: "最近感觉有些疲劳"
});
```

### 2. Anomaly Detection

- Runs detection on all submitted metrics
- Aggregates anomalies across metrics
- Determines maximum severity level

### 3. Policy Evaluation

- Evaluates trigger policy against anomalies
- Applies cooldown checks
- Considers user preferences

### 4. Consultation Trigger (if policy allows)

- Formats HealthBrief into consultation question
- Sets priority based on severity
- Invokes consultation orchestrator
- Links consultation ID back to brief

### 5. Result

```typescript
interface HealthBriefResult {
  briefId: string;
  status: "analyzed" | "triggered" | "skipped" | "failed";
  anomalies: Anomaly[];
  maxSeverity: AnomalySeverity | null;
  consultationTriggered: boolean;
  consultationId?: string;
  skipReason?: string;
}
```

---

## Severity Levels

| Level | Description | Trigger Behavior |
|-------|-------------|------------------|
| `mild` | Notable change, within expected variance | No trigger (unless threshold overridden) |
| `moderate` | Deviation from personal baseline | **Trigger** (V1 default threshold) |
| `attention` | Significant deviation, warrants attention | **Trigger** |

---

## Integration with Consultation Orchestrator

The HealthBrief system integrates with `web/src/lib/engine/orchestrator.ts` through:

### Entry Point

```typescript
// web/src/lib/health-brief/index.ts
export async function processHealthBrief(
  input: HealthBriefInput,
  userPreference?: UserTriggerPreference
): Promise<HealthBriefResult>
```

### Consultation Question Format

When triggered, the formatter generates a structured question:

```
基于健康数据的自动咨询请求

【健康指标快照】
- 体重: 75.5kg（采集于 2月11日 14:30）
- 心率: 95bpm（采集于 2月11日 14:30）

【检测到的异常】
⚡ 心率: 中等 - 您的心率（95bpm）较个人基线（72bpm）增加了32%

【用户补充说明】
最近感觉有些疲劳

【咨询问题】
根据上述健康数据，特别是检测到的1项异常变化，希望了解是否需要就医检查，以及日常生活中需要注意的事项。
```

### Priority Mapping

| Max Severity | Consultation Priority |
|--------------|----------------------|
| `mild` | `low` |
| `moderate` | `normal` |
| `attention` | `high` |

---

## File Structure

```
web/src/lib/health-brief/
├── types.ts      # Type definitions and interfaces
├── policy.ts     # Trigger policy engine
├── formatter.ts  # Consultation input formatter
└── index.ts      # Main orchestration and exports
```

---

## API Reference

### Types (types.ts)

- `HealthBrief` - Core brief structure
- `HealthBriefInput` - Input for creation
- `HealthBriefResult` - Processing result
- `TriggerPolicy` - Policy type union
- `FormattedConsultationInput` - Formatter output
- `UserTriggerPreference` - User customization

### Policy (policy.ts)

- `evaluateTriggerPolicy(context, override?)` - Main evaluation
- `getPolicyConfig()` - Get V1 config
- `getDefaultPolicy()` - Get default policy
- `wouldTriggerAtSeverity(severity, preference?)` - Preview check
- `getPolicyDescription(policy)` - UI text

### Formatter (formatter.ts)

- `formatForConsultation(brief)` - Main formatter
- `formatForPreview(brief)` - Preview text
- `buildShortSummary(brief)` - Notification text

### Integration (index.ts)

- `processHealthBrief(input, preference?)` - End-to-end processing
- `shouldTriggerConsultation(metrics, preference?)` - Sync preview

---

## Error Handling

| Error Scenario | Behavior | Result Status |
|----------------|----------|---------------|
| Anomaly detection fails | Logs error, returns partial result | `failed` |
| Consultation fails | Brief marked triggered, error logged | `triggered` (with error) |
| Policy evaluation error | Falls back to no trigger | `skipped` |

---

## Future Evolution

### V2 Considerations

- Multiple consultation types (urgent vs routine)
- Smart cooldown (different per severity)
- Batch brief processing
- ML-based anomaly detection
- Integration with wearable device APIs

### Contract Versioning

The `policyVersion` field enables backward-compatible evolution:

```typescript
type PolicyVersion = "v1" | "v2"; // Future
```

---

## Implementation Notes

- HealthBrief uses the existing `detectAnomalies` function from `web/src/lib/anomaly/detector.ts`
- Consultation triggering reuses `runConsultation` from `web/src/lib/engine/orchestrator.ts`
- No new database tables required (uses existing consultation storage)
- Chinese UI text is built into the formatter for user-facing displays

---

## Success Criteria Verification

- [x] HealthBrief contract documented and versioned (v1.0.0)
- [x] V1 default policy is `anomaly_only` with override strategy
- [x] Integration with consultation orchestrator verified via `processHealthBrief`
