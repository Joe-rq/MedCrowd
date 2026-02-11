# MedCrowd Analytics Event Dictionary

## Overview

This document defines the analytics event schema for MedCrowd's health data engagement loop. Events are designed to track WAU (Weekly Active Users) and user engagement patterns while maintaining strict privacy standards.

## WAU (Weekly Active Users) Definition

**WAU Calculation:**
```sql
SELECT 
  COUNT(DISTINCT userId) as wau
FROM events
WHERE type IN (
  'health.weekly_report.opened',
  'health.anomaly_alert.viewed', 
  'health.alert.return_visit',
  'health.question.submitted',
  'health.report.shared'
)
AND timestamp >= NOW() - INTERVAL '7 days'
```

**WAU-Eligible Events:** All events in this dictionary count toward WAU calculation.

## Event Schema

### Core Engagement Loop Events

#### 1. health.weekly_report.opened

Fired when a user opens their weekly health report.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Constant: `"health.weekly_report.opened"` |
| `userId` | string | Anonymized user identifier (hashed) |
| `timestamp` | number | Unix epoch in milliseconds |
| `reportId` | string | Unique report identifier |
| `hasAnomaly` | boolean | Whether report contains anomaly alerts |
| `consultationId` | string? | Optional link to consultation |
| `sessionId` | string? | Optional session identifier |

**WAU Signal:** Primary engagement indicator  
**Use Case:** Track weekly report engagement, identify users who regularly check reports

**Example:**
```json
{
  "type": "health.weekly_report.opened",
  "userId": "u_abc123",
  "timestamp": 1704067200000,
  "reportId": "report_week_03_2024",
  "hasAnomaly": true,
  "consultationId": "cons_xyz789"
}
```

---

#### 2. health.anomaly_alert.viewed

Fired when a user views an anomaly alert detail.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Constant: `"health.anomaly_alert.viewed"` |
| `userId` | string | Anonymized user identifier (hashed) |
| `timestamp` | number | Unix epoch in milliseconds |
| `alertId` | string | Unique alert identifier |
| `severity` | enum | `"low" \| "medium" \| "high"` |
| `metricType` | string | Metric category (e.g., `heart_rate`, `sleep`, `steps`) |
| `consultationId` | string? | Optional link to consultation |
| `sessionId` | string? | Optional session identifier |

**WAU Signal:** Strong engagement indicator  
**Use Case:** Track alert engagement by severity, identify high-priority alerts

**Example:**
```json
{
  "type": "health.anomaly_alert.viewed",
  "userId": "u_abc123",
  "timestamp": 1704067200000,
  "alertId": "alert_hr_001",
  "severity": "high",
  "metricType": "heart_rate",
  "consultationId": "cons_xyz789"
}
```

---

#### 3. health.alert.return_visit

Fired when a user returns to the app after clicking an alert notification.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Constant: `"health.alert.return_visit"` |
| `userId` | string | Anonymized user identifier (hashed) |
| `timestamp` | number | Unix epoch in milliseconds |
| `sourceAlertId` | string | The alert that triggered the return |
| `entryPoint` | enum | `"push" \| "email" \| "sms" \| "deep_link"` |
| `timeSinceAlertMinutes` | number | Time elapsed since alert was sent |
| `sessionId` | string? | Optional session identifier |

**WAU Signal:** Reactivation indicator  
**Use Case:** Measure notification effectiveness, track reactivation latency

**Example:**
```json
{
  "type": "health.alert.return_visit",
  "userId": "u_abc123",
  "timestamp": 1704067500000,
  "sourceAlertId": "alert_hr_001",
  "entryPoint": "push",
  "timeSinceAlertMinutes": 5
}
```

---

### Additional Engagement Events

#### 4. health.question.submitted

Fired when a user submits a health question.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Constant: `"health.question.submitted"` |
| `userId` | string | Anonymized user identifier (hashed) |
| `timestamp` | number | Unix epoch in milliseconds |
| `questionHash` | string | Hashed question content (no PII) |
| `questionLength` | number | Character count |
| `category` | enum | `"pre_visit" \| "during_visit" \| "post_visit" \| "medication" \| "mental" \| "general"` |
| `sessionId` | string? | Optional session identifier |

**WAU Signal:** Core engagement  
**Use Case:** Track question volume by category, identify trending topics

**Example:**
```json
{
  "type": "health.question.submitted",
  "userId": "u_abc123",
  "timestamp": 1704067200000,
  "questionHash": "hash_a1b2c3",
  "questionLength": 45,
  "category": "pre_visit"
}
```

---

#### 5. health.report.shared

Fired when a user shares a report.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Constant: `"health.report.shared"` |
| `userId` | string | Anonymized user identifier (hashed) |
| `timestamp` | number | Unix epoch in milliseconds |
| `reportId` | string | Unique report identifier |
| `shareChannel` | enum | `"copy_link" \| "wechat" \| "email" \| "other"` |
| `consultationId` | string | Associated consultation ID |
| `sessionId` | string? | Optional session identifier |

**WAU Signal:** Viral engagement  
**Use Case:** Track viral coefficient, identify popular share channels

**Example:**
```json
{
  "type": "health.report.shared",
  "userId": "u_abc123",
  "timestamp": 1704067200000,
  "reportId": "report_week_03_2024",
  "shareChannel": "copy_link",
  "consultationId": "cons_xyz789"
}
```

---

## Privacy & Security

### PII Handling

1. **User IDs are anonymized** using a deterministic hash function
2. **Question content is hashed** - only length and category are stored
3. **No medical data** in event payloads
4. **No timestamps** with second precision (day-level only for external storage)

### Data Retention

- **Hot storage:** 30 days (for real-time analytics)
- **Warm storage:** 90 days (for WAU calculations)
- **Cold storage:** 1 year (aggregated metrics only)

## Implementation Notes

### Event Emission

Events are emitted via the `emit*` functions in `web/src/lib/analytics/health-events.ts`:

```typescript
import { emitWeeklyReportOpened } from '@/lib/analytics/health-events';

// In your component
emitWeeklyReportOpened({
  userId: session.userId,
  reportId: report.id,
  hasAnomaly: report.anomalies.length > 0,
  consultationId: consultation.id,
});
```

### Configuration

Configure the analytics handler at app initialization:

```typescript
import { configureAnalyticsHandler } from '@/lib/analytics/health-events';

configureAnalyticsHandler((event) => {
  // Send to your analytics provider
  analytics.track(event.type, event);
});
```

### Decoupling Principle

Events are **decoupled from business logic**:
- Events are fire-and-forget
- Analytics failures never break user-facing features
- Events are no-ops until a handler is configured
- Safe to call on server-side (silently dropped)

## Metrics & Dashboards

### Key Metrics

| Metric | Calculation |
|--------|-------------|
| WAU | Unique users with any WAU event in last 7 days |
| Report Open Rate | `weekly_report.opened` / reports generated |
| Alert Engagement Rate | `anomaly_alert.viewed` / alerts sent |
| Return Visit Rate | `alert.return_visit` / alerts sent |
| Share Rate | `report.shared` / reports viewed |

### Funnel Analysis

```
Alert Sent → Alert Viewed → Report Opened → Question Submitted
   100%          60%            40%              15%
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02-11 | Initial event dictionary for Wave 1 |
