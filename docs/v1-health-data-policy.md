# MedCrowd Personal Health Data V1 Policy

> **Status**: Draft for Review  
> **Version**: 1.0  
> **Date**: 2025-02-11  
> **Scope**: Wave 1 Launch (MVP)

---

## 1. Product Overview

MedCrowd Personal Health Data feature enables users to track and receive wellness guidance on basic health metrics through an AI-mediated A2A consultation network. This document establishes the policy framework, metric scope, and safety guardrails for V1 launch.

### 1.1 Core Value Proposition

- **Detect**: Identify trends and anomalies in personal health metrics
- **Consult**: Anonymous A2A consultation when anomalies are detected
- **Track**: Continuous monitoring and trend visualization

### 1.2 Non-Diagnostic Principle

**MedCrowd does not provide medical diagnosis, treatment recommendations, or clinical interpretations.** All outputs are:
- Wellness guidance based on general health knowledge
- Aggregated peer experiences (not medical advice)
- Suggestions to consult healthcare professionals when appropriate

---

## 2. V1 Metric Scope

### 2.1 Supported Metrics (IN SCOPE)

| Category | Metrics | Data Source | Guidance Type |
|----------|---------|-------------|---------------|
| **Body Composition** | Weight, BMI | Manual entry / Connected devices | Trend analysis, healthy range reference |
| **Sleep** | Duration, Sleep schedule consistency | Manual entry / Wearables | Sleep hygiene suggestions |
| **Cardiovascular** | Resting heart rate, HRV (Heart Rate Variability) | Wearables | Baseline comparison, anomaly flagging |

### 2.2 Metric Specifications

#### Weight / BMI
- **Unit**: kg (weight), kg/m² (BMI)
- **Frequency**: Daily recommended, minimum weekly
- **Reference ranges**: WHO standard BMI categories (underweight/normal/overweight/obese)
- **Anomaly detection**: Significant change (>5% in 30 days, >10% in 90 days)
- **Output**: "Your weight has changed X% over Y days. This is [within/above/below] typical fluctuation ranges."

#### Sleep
- **Metrics**: Total duration, sleep onset time, wake time
- **Frequency**: Daily
- **Reference ranges**: 7-9 hours for adults (CDC recommendation)
- **Anomaly detection**: <5 hours or >10 hours consistently; irregular schedule (>2hr variance)
- **Output**: "Your sleep pattern shows [consistency/variability]. Consider [specific sleep hygiene tip]."

#### Heart Rate / HRV
- **Metrics**: Resting HR (morning), HRV (if available)
- **Frequency**: Daily or per wearable sync
- **Reference ranges**: 
  - Resting HR: 60-100 bpm (general adult population)
  - HRV: Individual baseline comparison (highly personalized)
- **Anomaly detection**: Resting HR >100 or <50 for 3+ consecutive days; HRV drop >30% from personal baseline
- **Output**: "Your resting heart rate is [elevated/lower] than your usual baseline. This could be due to [factors like stress, illness, overtraining]."

---

## 3. Detect -> Consult -> Track Model

### 3.1 Model Overview

```
┌─────────┐     ┌──────────┐     ┌─────────┐
│ DETECT  │────▶│ CONSULT  │────▶│  TRACK  │
└─────────┘     └──────────┘     └─────────┘
```

### 3.2 Phase Details

#### Phase 1: DETECT
**Trigger**: User submits health question with metric data OR metric anomaly detected

**System Actions**:
1. Parse and validate submitted metrics
2. Compare against population norms and personal baselines
3. Flag anomalies using rule-based thresholds
4. Classify concern level: `none` | `mild` | `moderate` | `requires_attention`

**Output**: Detection report with anomaly flags and context

#### Phase 2: CONSULT
**Trigger**: User chooses to consult OR anomaly level is `moderate` or `requires_attention`

**System Actions**:
1. Initiate A2A consultation with context-enriched prompt
2. Include metric context in system prompt: "User reports resting HR of 110 bpm for past 5 days"
3. Consult 3-5 available agents concurrently
4. Execute reaction round if ≥2 valid responses
5. Generate structured report

**Output**: MedCrowd consultation report with consensus and peer perspectives

**Consultation Handoff Default**: `anomaly_only`
- Only trigger automatic consultation for moderate+ anomalies
- User can manually consult for any metric entry
- User can disable auto-consult per metric type

#### Phase 3: TRACK
**Trigger**: Continuous after first metric entry

**System Actions**:
1. Store metrics with timestamps
2. Calculate trends (7-day, 30-day, 90-day averages)
3. Visualize trends in user dashboard
4. Surface insights: "Your sleep has improved 15% this month"
5. Periodic wellness nudges (weekly summary)

**Output**: Trend visualizations, weekly summaries, milestone celebrations

---

## 4. Non-Diagnostic Copy Rules

### 4.1 Absolute Prohibitions

| Prohibited Language | Why | Example Violation |
|---------------------|-----|-------------------|
| "You have [condition]" | Diagnostic statement | "You have hypertension" |
| "You should take [medication]" | Treatment recommendation | "You should take beta blockers" |
| "Your [metric] indicates [disease]" | Clinical interpretation | "Your HRV indicates heart disease" |
| "This is normal/abnormal" | Binary clinical judgment | "Your BMI is abnormal" |
| "Risk of [serious condition]" | Risk assessment without context | "Risk of heart attack" |

### 4.2 Required Replacements

| Instead of | Use | Rationale |
|------------|-----|-----------|
| "Your BMI is overweight" | "Your BMI falls in the range that WHO classifies as 'overweight' for general populations" | References external standard without clinical judgment |
| "Your heart rate is too high" | "Your resting heart rate is higher than the typical range for adults (60-100 bpm)" | Factual comparison to population norms |
| "You have insomnia" | "Your sleep pattern shows shorter duration than the 7-9 hours recommended for adults" | Describes pattern without diagnosis |
| "This is dangerous" | "This metric may warrant attention from a healthcare professional" | Encourages professional consultation |
| "You need to lose weight" | "A gradual adjustment toward a BMI in the 18.5-24.9 range may support overall wellness" | Neutral, goal-oriented language |

### 4.3 Wellness Guidance Framework

All guidance must follow the **SUGGEST** pattern:

- **S**hare: Present factual data
- **U**nderstand: Acknowledge individual variability
- **G**uide: Offer general wellness practices
- **G**ive options: Provide actionable but non-prescriptive suggestions
- **E**ncourage: Motivate professional consultation when appropriate
- **S**upport: Maintain encouraging, non-judgmental tone
- **T**rack: Emphasize continued monitoring

---

## 5. V1 Exclusions (OUT OF SCOPE)

### 5.1 Metrics NOT Supported

| Category | Excluded Metrics | Rationale |
|----------|------------------|-----------|
| **Glucose** | Blood sugar, A1C | Requires clinical interpretation; diabetes management is medical |
| **Blood Pressure** | Systolic/diastolic | Hypertension diagnosis territory; too close to clinical care |
| **Blood Labs** | Cholesterol, liver enzymes, etc. | Clinical lab results require physician interpretation |
| **Mental Health** | PHQ-9, GAD-7 scores | Requires licensed professional assessment |
| **Medical Devices** | CGM, pacemaker data, etc. | Medical device data is clinical territory |
| **Medication** | Dosage tracking, adherence | Pharmacological management is clinical |
| **Symptoms** | Pain scales, symptom severity | Leads to diagnostic territory |

### 5.2 Features NOT Included

| Feature | Status | Rationale |
|---------|--------|-----------|
| Trend predictions | Excluded | Predictive health statements approach diagnosis |
| Personalized health plans | Excluded | Individualized plans are prescriptive |
| Goal setting with targets | Excluded | Specific targets (e.g., "lose 10kg") can be harmful without supervision |
| Integration with EMR/EHR | Excluded | Medical record integration is clinical |
| Family sharing | Excluded | Privacy and consent complexity |
| Data export for physicians | Excluded | Exporting for clinical use requires compliance review |

### 5.3 Language NOT Permitted

- Any diagnostic statements ("you have X condition")
- Any treatment recommendations ("you should do X")
- Any prognostic statements ("this will lead to X")
- Any risk stratification ("you are at high risk for X")
- Any medication advice ("consider taking X")
- Any dosage or regimen recommendations

---

## 6. Safety Guardrails

### 6.1 Existing Safety Infrastructure

MedCrowd already implements safety checks in `web/src/lib/safety.ts`:

- **Self-harm keywords**: Detects and redirects to crisis resources
- **Emergency keywords**: Detects and redirects to emergency services (120)

### 6.2 Personal Health Data Specific Guards

#### Metric Validation
- Reject physiologically impossible values (e.g., HR >220, weight <20kg for adults)
- Flag values requiring immediate medical attention (HR >150 at rest)
- Require confirmation for extreme entries

#### Anomaly Escalation
| Anomaly Level | User Notification | Consultation Trigger | Disclaimer Emphasis |
|---------------|-------------------|----------------------|---------------------|
| None | None | Manual only | Standard |
| Mild | Dashboard badge | Manual only | Standard |
| Moderate | In-app notification | Optional auto-consult | Enhanced |
| Requires Attention | Banner + notification | Recommended consult | Maximum |

#### Extreme Value Protocol
For values indicating potential medical emergency:
1. Immediate display of emergency disclaimer
2. Recommendation to seek immediate care
3. No consultation initiated (not appropriate for A2A)
4. Log for safety review

### 6.3 Consultation Context Enrichment

When consulting with metric anomalies:

```
User context to include in consultation:
- Metric type and value
- Trend direction (increasing/decreasing/stable)
- Duration of pattern
- Self-reported lifestyle factors (optional)

NOT included:
- Medical history
- Medications
- Symptoms
- Diagnostic interpretations
```

---

## 7. WAU Target Behavior Loop

### 7.1 Target WAU Behavior

**Primary Goal**: Users engage with their health data weekly through tracking, review, or consultation.

### 7.2 Behavior Loop Design

```
        ┌─────────────────────────────────────────┐
        │                                         │
        ▼                                         │
┌───────────────┐    ┌───────────────┐    ┌──────▼────────┐
│   DISCOVER    │───▶│    ENGAGE     │───▶│    VALUE      │
│  (First metric │    │ (Track weekly │    │ (Insights &   │
│   entry)      │    │  + consult)   │    │  community)   │
└───────────────┘    └───────────────┘    └───────────────┘
                                                       │
        ┌──────────────────────────────────────────────┘
        │
        ▼
┌───────────────┐    ┌───────────────┐
│    HABIT      │◀───│    REMIND     │
│ (Weekly check-│    │ (Smart nudges │
│  in ritual)   │    │  + trends)    │
└───────────────┘    └───────────────┘
```

### 7.3 Weekly Engagement Touchpoints

| Touchpoint | Trigger | Channel | Content |
|------------|---------|---------|---------|
| Weekly Summary | Every 7 days | In-app | Trend highlights, milestones, community insights |
| Anomaly Alert | Metric outside baseline | Push + In-app | "Your sleep pattern has changed..." |
| Consultation Follow-up | Post-consultation | In-app | "See what the community said about your question" |
| Trend Milestone | 30-day trend complete | In-app | "You've tracked sleep for 30 days!" |
| Re-engagement | 7 days inactive | Push | "Check in on your wellness trends" |

### 7.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Weekly Active Users (WAU) | 30% of registered users | Tracked users with entry/consult/view |
| Metric entry frequency | 2+ entries/week per active user | Average entries per user per week |
| Consultation rate | 20% of users with anomalies | Users consulting / users with anomalies |
| Return rate | 40% return within 7 days | Users with 7-day return |

---

## 8. Compliance & Legal

### 8.1 Disclaimer Requirements

**Every report must include** (already implemented in `web/src/lib/summary/pipeline.ts`):

> 以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。健康问题请务必咨询专业医疗机构和医生。

**Additional disclaimer for health data**:

> 本功能提供的健康数据追踪和趋势分析仅供个人健康管理参考，不能替代专业医疗诊断。如有健康疑虑，请咨询持牌医疗专业人员。

### 8.2 Data Handling

- All metric data encrypted at rest and in transit
- User retains ownership of their health data
- No sharing of individual data with other users (anonymized aggregation only)
- Retention: 90 days of detailed data, indefinite aggregated trends
- Export: User can request their data export

### 8.3 Jurisdiction

This V1 policy is designed for users in China mainland. International expansion requires jurisdiction-specific policy review.

---

## 9. References

### 9.1 Implementation Files

| Policy Element | Implementation File |
|----------------|---------------------|
| High-risk detection | `web/src/lib/safety.ts` |
| Report generation | `web/src/lib/summary/pipeline.ts` |
| Report types | `web/src/lib/summary/types.ts` |
| A2A consultation | `web/src/lib/engine.ts` |

### 9.2 External References

- WHO BMI Classification: https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight
- CDC Sleep Guidelines: https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html
- American Heart Association Heart Rate Guide: https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-11 | Initial V1 policy document |

---

## 11. Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | | | ⬜ Pending |
| Legal Review | | | ⬜ Pending |
| Medical Advisor | | | ⬜ Pending |
| Engineering Lead | | | ⬜ Pending |
