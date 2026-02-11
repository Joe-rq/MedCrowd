# MedCrowd Personal Health Data V1 Scope Definitions

> **Status**: Locked for V1  
> **Version**: 1.0  
> **Date**: 2025-02-11  

---

## 1. Scope Philosophy

### 1.1 The "Wellness Only" Boundary

V1 is strictly limited to **wellness tracking and general health awareness**. We deliberately exclude anything that approaches clinical care, diagnostic interpretation, or treatment management.

### 1.2 Decision Framework

For any feature or metric under consideration, use this flow:

```
Does it require clinical interpretation?
    │
    ├── YES → OUT OF SCOPE for V1
    │
    └── NO → Can it be framed as general wellness guidance?
                │
                ├── NO → OUT OF SCOPE for V1
                │
                └── YES → IN SCOPE with copy review
```

---

## 2. IN SCOPE (V1 Supported)

### 2.1 Metrics (Confirmed)

| # | Metric Category | Specific Metrics | Rationale |
|---|-----------------|------------------|-----------|
| 1 | **Body Composition** | Weight (kg), BMI | Population norms well-established; wellness framing natural |
| 2 | **Sleep** | Duration (hours), Bedtime/waketime consistency | CDC guidelines clear; lifestyle factor, not clinical |
| 3 | **Cardiovascular** | Resting heart rate (bpm), HRV (ms) if available | Consumer wearables provide this; general fitness context |

### 2.2 Features (Confirmed)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Manual Entry** | Users input metrics via form (all types) |
| 2 | **Wearable Sync** | Import from Apple Health, Google Fit (read-only) |
| 3 | **Trend Visualization** | 7/30/90-day charts with personal baselines |
| 4 | **Anomaly Detection** | Rule-based flagging vs. personal/population norms |
| 5 | **A2A Consultation** | Trigger consultation when anomaly detected |
| 6 | **Weekly Summaries** | Automated trend summaries and insights |
| 7 | **Basic Goals** | Soft tracking ("track 5 days this week") not targets |

### 2.3 Data Types (Confirmed)

| # | Data Type | Usage |
|---|-----------|-------|
| 1 | Numeric metrics | Weight, BMI, HR, HRV values |
| 2 | Time data | Sleep timestamps, entry timestamps |
| 3 | Trends | Calculated averages, change percentages |
| 4 | Anomaly flags | Boolean flags + severity levels |
| 5 | Consultation context | Metric values shared in consultation prompts |

### 2.4 User Actions (Confirmed)

| # | Action | Description |
|---|--------|-------------|
| 1 | Add entry | Log new metric value with timestamp |
| 2 | View history | See past entries in list/chart form |
| 3 | Edit entry | Correct mistakes within 24 hours |
| 4 | Delete entry | Remove entry (with confirmation) |
| 5 | Trigger consultation | Request A2A consultation with metric context |
| 6 | Set preferences | Enable/disable auto-consult per metric |
| 7 | Export data | Download personal data (CSV/JSON) |

---

## 3. OUT OF SCOPE (V1 Exclusions)

### 3.1 Metrics (Explicitly Excluded)

| # | Metric Category | Specific Metrics | Exclusion Rationale |
|---|-----------------|------------------|---------------------|
| 1 | **Blood Glucose** | Fasting glucose, random glucose, A1C | Diabetes management is clinical; requires physician interpretation |
| 2 | **Blood Pressure** | Systolic, diastolic, pulse pressure | Hypertension diagnosis territory; medication implications |
| 3 | **Blood Lipids** | Total cholesterol, LDL, HDL, triglycerides | Clinical lab values; treatment thresholds |
| 4 | **Lab Values** | Liver enzymes, kidney function, thyroid, etc. | All require clinical interpretation |
| 5 | **Oxygen Saturation** | SpO2 | Clinical monitoring metric; COPD/respiratory implications |
| 6 | **Body Temperature** | Basal body temp, fever tracking | Diagnostic for illness; clinical decision point |
| 7 | **Respiratory Rate** | Breaths per minute | Clinical vital sign |
| 8 | **Mental Health Scores** | PHQ-9, GAD-7, any diagnostic questionnaires | Requires licensed professional administration |
| 9 | **Pain Scores** | 1-10 pain scales | Symptom severity tracking approaches diagnosis |
| 10 | **Menstrual Tracking** | Cycle length, flow, symptoms | Reproductive health has clinical implications |
| 11 | **Medical Device Data** | CGM, pacemaker, CPAP data | Medical device data is regulated/clinical |
| 12 | **Genetic Data** | Any genetic markers or ancestry health data | Far beyond wellness scope |

### 3.2 Features (Explicitly Excluded)

| # | Feature | Exclusion Rationale |
|---|---------|---------------------|
| 1 | **Diagnostic Assessment** | Any feature that outputs a condition name | Diagnostic territory |
| 2 | **Treatment Plans** | Individualized recommendations for diet, exercise, medication | Prescriptive; requires clinical oversight |
| 3 | **Medication Tracking** | Logging prescriptions, dosages, adherence | Pharmacological management |
| 4 | **Symptom Tracking** | Logging specific symptoms and their severity | Leads to diagnostic conclusions |
| 5 | **Risk Scoring** | Calculating risk percentages for diseases | Risk stratification is clinical |
| 6 | **Predictive Analytics** | ML predictions of future health outcomes | Predictions approach prognosis |
| 7 | **Personalized Targets** | Specific goals ("lose 10kg by June") | Can be harmful without supervision |
| 8 | **Calorie/Nutrition Tracking** | Detailed food logging and analysis | Complex; borderline clinical for conditions |
| 9 | **EMR/EHR Integration** | Connecting to hospital systems | Medical record integration requires compliance |
| 10 | **Provider Sharing** | Sending data to doctors | Clinical use case requires regulatory review |
| 11 | **Family/Caregiver Access** | Sharing data with family members | Privacy and consent complexity |
| 12 | **Health Coaching** | Human or AI coaching interactions | Coaching is regulated in many jurisdictions |
| 13 | **Gamification** | Points, leaderboards, competitions | Inappropriate for health context |
| 14 | **Social Comparison** | Comparing metrics to other users | Privacy and psychological risks |
| 15 | **Monetization** | Premium features, subscriptions | Out of scope for V1 MVP |

### 3.3 Language Patterns (Prohibited)

| # | Pattern Category | Examples | Why Excluded |
|---|------------------|----------|--------------|
| 1 | **Diagnosis** | "You have hypertension" "This indicates diabetes" "You are pre-diabetic" | Diagnostic statements require licensed professional |
| 2 | **Treatment Recommendations** | "Start taking medication" "You should do keto diet" "Try intermittent fasting" | Treatment requires medical supervision |
| 3 | **Dosage/Medical Instructions** | "Take 500mg twice daily" "Monitor BP 3x daily" | Medical instructions are clinical |
| 4 | **Prognosis** | "This will lead to heart disease" "You're at risk for stroke" | Predicting outcomes is clinical |
| 5 | **Risk Stratification** | "High risk" "Low risk" "Moderate risk" without context | Risk categories imply clinical judgment |
| 6 | **Binary Clinical Judgments** | "Normal" "Abnormal" "Healthy" "Unhealthy" | Binary health judgments are diagnostic |
| 7 | **Medical Urgency (overstated)** | "You need immediate attention" (for non-emergency) | Creates unnecessary alarm |
| 8 | **Professional Role Claims** | "As your health advisor" "I recommend" (AI persona) | Impersonates clinical role |

### 3.4 Use Cases (Excluded)

| # | Use Case | Why Excluded |
|---|----------|--------------|
| 1 | Managing chronic disease | Requires clinical oversight (diabetes, hypertension, etc.) |
| 2 | Post-surgical monitoring | Clinical recovery monitoring |
| 3 | Pregnancy tracking | Medical care context; high risk |
| 4 | Pediatric health tracking | Children require pediatric care |
| 5 | Elderly fall detection | Medical emergency territory |
| 6 | Mental health monitoring | Requires licensed professional |
| 7 | Eating disorder recovery | Requires specialized clinical care |
| 8 | Sports performance optimization | Can encourage overtraining; complex physiology |
| 9 | Weight loss competition | Psychological risks; gamification |
| 10 | Medical research participation | IRB, consent, regulatory complexity |

---

## 4. Boundary Cases

### 4.1 Gray Area Decisions

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| Step counting | OUT OF SCOPE | Too broad; not "health data" per se; fitness focus |
| Active calories | OUT OF SCOPE | Fitness metric, not health metric |
| Standing hours | OUT OF SCOPE | Behavioral nudge, not health tracking |
| Water intake | OUT OF SCOPE | Lifestyle habit, not metric tracking |
| Mindfulness minutes | OUT OF SCOPE | Wellness activity, not health data |
| VO2 max | OUT OF SCOPE | Athletic performance metric |
| Skin temperature | OUT OF SCOPE | Consumer wearable novelty; unclear wellness value |
| Blood oxygen during sleep | OUT OF SCOPE | Sleep apnea screening territory |
| ECG readings | OUT OF SCOPE | Clinical-grade data; arrhythmia detection |
| Fall detection | OUT OF SCOPE | Emergency medical feature |

### 4.2 Future Consideration (Post-V1)

These are explicitly NOT in V1 but may be considered for future versions with proper safeguards:

| Feature | Consideration Criteria |
|---------|------------------------|
| Blood pressure tracking | With clear "not for hypertension management" disclaimer; trend-only |
| Symptom logging | As "notes" not structured data; no analysis |
| Cycle tracking | As "calendar notes" not health metric |
| Enhanced AI insights | With medical advisor review of all output |
| Provider reports | With HIPAA/GDPR compliance review |
| Family sharing | With consent framework and granular permissions |

---

## 5. Scope Change Process

### 5.1 Change Request Workflow

```
Feature Request
      │
      ▼
┌─────────────────┐
│  Pre-screening  │ → Check against OUT OF SCOPE list
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
CLEARLY OUT   UNCLEAR
    │         │
    ▼         ▼
  REJECT   ┌─────────────────┐
           │  Policy Review  │ → Medical advisor review
           └────────┬────────┘
                    │
               ┌────┴────┐
               │         │
           APPROVED   REJECTED
               │         │
               ▼         ▼
          ADD TO      DOCUMENT
           V1.1       REASON
```

### 5.2 Approval Requirements

| Scope Change Type | Approvers Required |
|-------------------|-------------------|
| New metric | Product + Medical Advisor |
| New feature | Product + Legal + Engineering Lead |
| Language pattern change | Medical Advisor + Legal |
| Exclusion removal | All: Product, Legal, Medical Advisor, Engineering |

---

## 6. Implementation Checklist

### 6.1 For Engineering

- [ ] Metric validation rejects OUT OF SCOPE data types
- [ ] API endpoints only accept IN SCOPE metric IDs
- [ ] UI does not display OUT OF SCOPE metrics
- [ ] Error messages for rejected metric types
- [ ] Consultation prompts exclude clinical language patterns

### 6.2 For Product

- [ ] User-facing copy reviewed against prohibited patterns
- [ ] All guidance copy uses "wellness" framing
- [ ] Disclaimer visible on all health data screens
- [ ] Help content explains scope limitations

### 6.3 For QA

- [ ] Test cases for OUT OF SCOPE metric rejection
- [ ] Test cases for prohibited language detection
- [ ] Test cases for extreme value handling
- [ ] Test cases for consultation with metric context

---

## 7. Reference

### 7.1 Related Documents

| Document | Purpose |
|----------|---------|
| `v1-health-data-policy.md` | Complete policy including safety guardrails |
| `safety-wording-checklist.md` | Copy guidelines with concrete examples |
| `web/src/lib/safety.ts` | Implementation of high-risk keyword detection |
| `web/src/lib/summary/pipeline.ts` | Report generation and disclaimer injection |

### 7.2 Regulatory References

- China NMPA Medical Device Classification
- FDA General Wellness Policy (US context)
- FTC Health Products Compliance Guidance

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-11 | Initial V1 scope lock |

---

## 9. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | | | ⬜ |
| Medical Advisor | | | ⬜ |
| Legal | | | ⬜ |
| Engineering Lead | | | ⬜ |
