# MedCrowd V2 Medical Document Ingestion Architecture

> **Status**: Architecture Blueprint (V2 Design Phase)  
> **Version**: 2.0.0-draft  
> **Date**: 2025-02-11  
> **Scope**: Medical Record & Physical Exam Report Ingestion System

---

## 1. Executive Summary

This document defines the architecture for V2 medical document ingestion capabilities, enabling users to upload medical records (PDF, images) and physical examination reports for structured extraction and integration with the existing MedCrowd A2A consultation system.

**Key Design Principles**:
- **Privacy-first**: All processing happens within controlled pipelines; no third-party OCR services
- **Wellness boundary**: Extracted data supplements consultation context; no diagnostic interpretation
- **Progressive enhancement**: V1 health metrics remain functional; V2 adds document-derived context
- **Auditability**: Complete provenance chain from upload to extraction to consultation

---

## 2. Document Ingestion Flow

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT INGESTION PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐     ┌────────────┐     ┌──────────────┐     ┌─────────────┐
    │  UPLOAD  │────▶│ VALIDATION │────▶│   PARSING    │────▶│ EXTRACTION  │
    └──────────┘     └────────────┘     └──────────────┘     └──────┬──────┘
                                                                    │
    ┌──────────┐     ┌────────────┐     ┌──────────────┐           │
    │  STORAGE │◀────│  INDEXING  │◀────│ CORRELATION  │◀──────────┘
    └──────────┘     └────────────┘     └──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION WITH CONSULTATION ENGINE                    │
│  ┌─────────────┐    ┌───────────────┐    ┌─────────────────────────────┐   │
│  │  HealthBrief │───▶│  Context Enrich │───▶│  A2A Consultation Engine   │   │
│  │   Trigger    │    │   (V2 Docs +    │    │  (Enhanced with medical    │   │
│  │              │    │   V1 Metrics)   │    │   context from docs)       │   │
│  └─────────────┘    └───────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase Details

#### Phase 1: UPLOAD

**Entry Points**:
- Web UI drag-and-drop upload
- Camera capture for physical documents
- Structured data import (HL7 FHIR, CDA)

**Upload Constraints**:
| Constraint | Limit | Rationale |
|------------|-------|-----------|
| File size | 10MB max | Storage optimization; most medical reports under 5MB |
| Files per user | 50 active | Prevent abuse; archive older documents |
| Daily upload | 10 files | Rate limiting for resource protection |
| File age | Reject >5 years | Stale data; encourage recent reports |

**Upload Record Creation**:
```typescript
interface DocumentUploadRecord {
  id: string;                    // doc-{uuid}
  userId: string;
  status: UploadStatus;          // pending | validating | processing | extracted | failed
  
  // Source metadata
  source: {
    filename: string;
    originalMimeType: string;    // application/pdf, image/jpeg, etc.
    detectedMimeType: string;    // Post-validation confirmed type
    fileSizeBytes: number;
    uploadedAt: number;
    uploadedFrom: "web" | "mobile" | "api";
  };
  
  // Security
  checksum: string;              // SHA-256 for integrity
  encryptionKeyId: string;       // Reference to key management
  
  // Processing
  processingAttempts: number;
  lastError?: string;
  
  createdAt: number;
  updatedAt: number;
}
```

#### Phase 2: VALIDATION

**Security Validation**:
1. **Malware scan**: Virus/malware detection on all uploads
2. **Format verification**: Magic number validation (not just extension)
3. **Content sanitization**: Strip embedded scripts, macros
4. **Size validation**: Confirm within limits

**Medical Document Validation**:
1. **Date recency**: Reject documents >5 years old (configurable)
2. **Content indicators**: Check for medical terminology presence
3. **Duplicate detection**: Perceptual hash comparison for near-duplicates

**Validation Result**:
```typescript
interface ValidationResult {
  valid: boolean;
  stage: "security" | "format" | "content" | "duplicate";
  errors: ValidationError[];
  warnings: ValidationWarning[];
  
  // Metadata extracted during validation
  detectedMetadata: {
    pageCount?: number;          // For PDFs
    imageDimensions?: { width: number; height: number };
    hasTextLayer: boolean;       // PDF has extractable text
    needsOCR: boolean;           // Requires OCR processing
  };
}
```

#### Phase 3: PARSING

**Format-Specific Parsing**:

| Format | Parser | Output |
|--------|--------|--------|
| PDF (text) | Native PDF text extraction | Structured text with positions |
| PDF (image) | OCR pipeline | Raw text + confidence scores |
| JPEG/PNG | Image preprocessing → OCR | Raw text + confidence scores |
| DICOM | Medical imaging parser | Metadata extraction (no pixel data) |
| HL7 FHIR | FHIR JSON parser | Structured resource bundle |
| CDA | CDA XML parser | Structured clinical document |

**OCR Pipeline** (for image-based documents):
```
Image Input → Preprocessing (deskew, denoise, enhance) 
            → Text Detection (region identification)
            → OCR Engine (local Tesseract or similar)
            → Post-processing (spell correction, medical term validation)
            → Structured Text Output
```

**Parser Boundaries** (see Section 3 for complete boundaries):
- ✅ We parse: Text content, tables, section headers, dates, medical terms
- ❌ We don't parse: Handwritten notes (unreliable), pixel-level medical images, audio

#### Phase 4: EXTRACTION

**Entity Extraction Model**:

```typescript
interface ExtractedDocument {
  id: string;                    // extract-{uuid}
  documentId: string;            // Reference to DocumentUploadRecord
  userId: string;
  
  // Extraction metadata
  extractionVersion: string;     // "v2.0.0"
  extractedAt: number;
  confidence: number;            // Overall extraction confidence (0-1)
  
  // Document classification
  documentType: DocumentType;    // physical_exam | lab_report | imaging_report | discharge_summary | other
  
  // Extracted entities
  entities: MedicalEntity[];
  
  // Relationships between entities
  relations: EntityRelation[];
  
  // Temporal information
  temporalContext: {
    reportDate?: string;         // ISO 8601
    effectiveDateRange?: { start: string; end: string };
    isHistoric: boolean;         // >1 year old
  };
  
  // Source provenance
  provenance: {
    sourceText: string;          // Original text snippet
    pageNumber?: number;
    boundingBox?: BoundingBox;
    confidence: number;
  }[];
}
```

**Entity Types** (see Section 4 for complete model):

| Category | Entity Types | Example |
|----------|--------------|---------|
| **Medications** | drug_name, dosage, frequency, route | "Metformin 500mg twice daily oral" |
| **Diagnoses** | condition_name, icd10_code, status | "Type 2 Diabetes Mellitus (E11.9)" |
| **Procedures** | procedure_name, date, result | "Complete Blood Count (2024-01-15)" |
| **Lab Results** | test_name, value, unit, reference_range | "HbA1c: 7.2% (reference: <5.7%)" |
| **Vitals** | vital_type, value, unit, position | "BP: 120/80 mmHg (sitting)" |
| **Providers** | provider_name, specialty, facility | "Dr. Smith, Cardiology, General Hospital" |

**Extraction Confidence Scoring**:
```typescript
interface ConfidenceScore {
  overall: number;               // Weighted average
  
  // Component scores
  ocrConfidence: number;         // OCR quality (if applicable)
  entityRecognition: number;     // Named entity recognition confidence
  normalization: number;         // Term mapping to standard codes
  contextValidation: number;     // Cross-entity consistency
  
  // Reliability flags
  requiresReview: boolean;       // Human verification recommended
  lowConfidenceEntities: string[]; // Entity IDs below threshold
}
```

#### Phase 5: STORAGE

**Storage Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     STORAGE LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Original Document (Encrypted Blob)               │
│  - Location: Vercel Blob / S3-compatible                   │
│  - Encryption: AES-256-GCM, per-user keys                  │
│  - Retention: 90 days (configurable)                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Parsed Text (Structured)                         │
│  - Location: Vercel KV                                     │
│  - Format: JSON with text positions                        │
│  - Retention: 90 days                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Extracted Entities (Query-Optimized)             │
│  - Location: Vercel KV (indexed)                           │
│  - Format: Normalized entities with provenance             │
│  - Retention: 365 days (long-term health context)          │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Audit Trail (Immutable)                          │
│  - Location: Vercel KV (append-only)                       │
│  - Format: Event log                                       │
│  - Retention: 7 years (compliance)                         │
└─────────────────────────────────────────────────────────────┘
```

**KV Key Schema Extensions**:
```typescript
// V2 Document Storage Keys (extends existing KV_KEYS)
documents: {
  // Upload metadata
  upload: (userId: string, docId: string) => 
    `doc:${userId}:upload:${docId}`,
  
  // User's document list (sorted set by upload time)
  userDocuments: (userId: string) => 
    `doc:${userId}:list`,
  
  // Parsed text content
  parsedText: (docId: string) => 
    `doc:${docId}:parsed`,
  
  // Extracted entities
  extraction: (docId: string) => 
    `doc:${docId}:extract`,
  
  // User's extracted entities index (for quick lookup)
  userEntities: (userId: string, entityType: string) => 
    `doc:${userId}:entities:${entityType}`,
  
  // Audit log
  auditEvent: (timestamp: number, eventId: string) => 
    `doc:audit:${timestamp}:${eventId}`,
  
  // User audit trail
  userAudit: (userId: string) => 
    `doc:${userId}:audit`,
}
```

#### Phase 6: INDEXING & CORRELATION

**Entity Indexing**:
- Inverted index: `entity_value → document_id[]`
- Temporal index: `date_range → document_id[]`
- Type index: `entity_type → entity_id[]`

**Health Metric Correlation**:
```typescript
interface CorrelationResult {
  // Links extracted entities to V1 health metrics
  correlations: {
    entityId: string;
    metricType: HealthMetricType;
    metricTimestamp: number;
    correlationType: "temporal" | "semantic" | "explicit";
    confidence: number;
    explanation: string;
  }[];
  
  // Context for consultation
  consultationContext: {
    relevantDocuments: string[];
    recentMetrics: HealthMetricPoint[];
    combinedTimeline: TimelineEvent[];
  };
}
```

---

## 3. Parser Boundaries

### 3.1 IN SCOPE (We Parse)

| Category | Specifics | Confidence Target |
|----------|-----------|-------------------|
| **Typed Text** | Printed medical reports, lab results, discharge summaries | >95% |
| **Structured Forms** | Standardized lab reports, insurance forms | >98% |
| **Tables** | Lab result tables, medication lists | >90% |
| **Dates** | Report dates, visit dates, effective dates | >99% |
| **Medical Terminology** | SNOMED CT, ICD-10, RxNorm terms | >92% |
| **Measurements** | Vital signs with units, lab values with reference ranges | >95% |
| **Section Headers** | "Assessment", "Plan", "Medications", "Lab Results" | >97% |

### 3.2 OUT OF SCOPE (We Don't Parse)

| Category | Rationale | Handling |
|----------|-----------|----------|
| **Handwritten Notes** | Unreliable OCR; medical liability risk | Flag for manual review; store image only |
| **Medical Images** | Radiology images, ECG tracings, photos | Extract metadata only; no pixel analysis |
| **Audio/Video** | Dictated notes, procedure recordings | Explicit rejection; not supported |
| **Real-time Streams** | Continuous monitoring data | Out of scope; different architecture |
| **Diagnostic Reasoning** | Clinical interpretations | Store text but don't extract as fact |
| **Mental Health Details** | Therapy notes, psychiatric assessments | Privacy sensitivity; minimal extraction |
| **Genetic Data** | Genetic test results, markers | Regulatory complexity; out of scope |

### 3.3 Quality Gates

**Minimum Quality Thresholds**:

```typescript
const PARSER_QUALITY_GATES = {
  // OCR quality
  ocr: {
    minCharacterConfidence: 0.85,
    minWordConfidence: 0.80,
    minOverallConfidence: 0.75,
  },
  
  // Extraction quality
  extraction: {
    minEntityConfidence: 0.70,
    minRelationConfidence: 0.60,
    maxUnknownEntities: 0.30,    // Max 30% unrecognized terms
  },
  
  // Document classification
  classification: {
    minTypeConfidence: 0.80,
    requireDateExtraction: true,
  },
};
```

**Fallback Behavior**:

| Quality Check | Failure Action | User Communication |
|---------------|----------------|-------------------|
| OCR confidence < 75% | Flag for review; attempt extraction with warnings | "Some text may be unclear; please review extracted information" |
| Document type unclear | Classify as "other"; extract generic entities only | "Document type not recognized; extracting general information" |
| No date found | Reject extraction; store image only | "Could not determine report date; please verify document" |
| Handwriting detected | Skip text extraction; store image | "Handwritten content detected; storing document for your records" |

---

## 4. Structured Extraction Model

### 4.1 Core Entity Schema

```typescript
// Base entity interface
type EntityType = 
  | "medication" 
  | "diagnosis" 
  | "procedure" 
  | "lab_result"
  | "vital_sign"
  | "provider"
  | "facility"
  | "date"
  | "measurement"
  | "symptom"
  | "allergy"
  | "immunization";

interface MedicalEntity {
  id: string;                    // entity-{uuid}
  type: EntityType;
  
  // Canonical representation
  canonical: {
    name: string;                // Normalized name
    code?: string;               // Standard code (ICD-10, RxNorm, etc.)
    codeSystem?: string;         // "ICD-10-CM", "RxNorm", "SNOMED CT"
  };
  
  // Original text
  text: {
    raw: string;                 // Exact text from document
    normalized: string;          // Normalized form
    start: number;               // Character position
    end: number;
  };
  
  // Attributes (type-specific)
  attributes: EntityAttributes;
  
  // Extraction metadata
  extraction: {
    confidence: number;
    method: "rule" | "ml" | "dictionary" | "hybrid";
    modelVersion: string;
    extractedAt: number;
  };
  
  // Provenance
  provenance: {
    documentId: string;
    pageNumber?: number;
    section?: string;
    boundingBox?: BoundingBox;
  };
}

// Type-specific attributes
type EntityAttributes =
  | MedicationAttributes
  | DiagnosisAttributes
  | ProcedureAttributes
  | LabResultAttributes
  | VitalSignAttributes
  | ProviderAttributes;

interface MedicationAttributes {
  dosage?: {
    value: number;
    unit: string;
  };
  frequency?: string;
  route?: string;
  prescribedDate?: string;
  status?: "active" | "discontinued" | "completed" | "unknown";
}

interface DiagnosisAttributes {
  icd10Code?: string;
  status?: "active" | "resolved" | "chronic" | "history_of";
  onsetDate?: string;
  severity?: "mild" | "moderate" | "severe";
}

interface ProcedureAttributes {
  cptCode?: string;
  date?: string;
  status?: "completed" | "scheduled" | "cancelled";
  result?: string;
  orderingProvider?: string;
}

interface LabResultAttributes {
  testCode?: string;             // LOINC code
  value: number | string;
  unit: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  interpretation?: "normal" | "abnormal" | "high" | "low" | "critical";
  collectedDate?: string;
  resultedDate?: string;
}

interface VitalSignAttributes {
  vitalType: "blood_pressure" | "heart_rate" | "temperature" | "respiratory_rate" | "oxygen_saturation" | "weight" | "height" | "bmi";
  value: number;
  unit: string;
  position?: "sitting" | "standing" | "supine" | "unknown";
  measuredDate?: string;
}

interface ProviderAttributes {
  name: string;
  specialty?: string;
  npi?: string;
  facility?: string;
  role?: "primary" | "referring" | "consulting";
}
```

### 4.2 Relation Schema

```typescript
interface EntityRelation {
  id: string;
  type: RelationType;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: number;
  
  // Context
  text: string;                  // Supporting text
  provenance: Provenance;
}

type RelationType =
  | "treats"           // Medication treats Diagnosis
  | "indicates"        // LabResult indicates Diagnosis
  | "ordered_for"      // Procedure ordered_for Diagnosis
  | "performed_by"     // Procedure performed_by Provider
  | "prescribed_by"    // Medication prescribed_by Provider
  | "measured_at"      // VitalSign measured_at Date
  | "result_of"        // LabResult result_of Procedure
  | "associated_with"; // Generic association
```

### 4.3 Document Classification

```typescript
type DocumentType = 
  | "physical_exam"      // Annual physical, wellness check
  | "lab_report"         // Blood work, urinalysis, etc.
  | "imaging_report"     // Radiology reports (not images)
  | "discharge_summary"  // Hospital discharge
  | "progress_note"      // Visit notes
  | "operative_report"   // Surgery reports
  | "pathology_report"   // Lab pathology
  | "medication_list"    // Current medications
  | "immunization_record"
  | "insurance_form"
  | "other";

interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  
  // Specialization
  specialty?: string;            // "cardiology", "primary_care", etc.
  
  // Temporal
  reportDate?: string;
  visitType?: "annual" | "follow_up" | "urgent" | "specialist" | "unknown";
  
  // Classification method
  method: "header_analysis" | "content_ml" | "hybrid";
}
```

### 4.4 Extraction Pipeline Output

```typescript
interface ExtractionPipelineResult {
  success: boolean;
  documentId: string;
  
  // Classification
  classification: DocumentClassification;
  
  // Extracted content
  entities: MedicalEntity[];
  relations: EntityRelation[];
  
  // Summary statistics
  statistics: {
    totalEntities: number;
    byType: Record<EntityType, number>;
    averageConfidence: number;
    lowConfidenceCount: number;
  };
  
  // Quality assessment
  quality: {
    overall: "high" | "medium" | "low";
    concerns: string[];
    requiresReview: boolean;
  };
  
  // Timeline
  timeline: TimelineEvent[];
  
  // Provenance (complete chain)
  provenance: {
    uploadId: string;
    parsedTextId: string;
    extractionVersion: string;
    processedAt: number;
  };
}
```

---

## 5. Compliance and Privacy Controls

### 5.1 Data Classification

| Data Category | Sensitivity | Retention | Encryption |
|---------------|-------------|-----------|------------|
| Original documents | High | 90 days | AES-256-GCM |
| Parsed text | High | 90 days | AES-256-GCM |
| Extracted entities | Medium | 365 days | AES-256 |
| Audit logs | Low | 7 years | At-rest only |
| Correlation results | Medium | 90 days | AES-256 |

### 5.2 Consent Model

**Granular Consent**:
```typescript
interface DocumentConsent {
  userId: string;
  
  // Upload consent
  upload: {
    granted: boolean;
    grantedAt: number;
    purpose: "consultation_context" | "personal_records" | "both";
  };
  
  // Processing consent
  processing: {
    ocrAllowed: boolean;
    extractionAllowed: boolean;
    correlationAllowed: boolean;  // Link to health metrics
  };
  
  // Consultation consent
  consultation: {
    includeInHealthBrief: boolean;
    shareWithAgents: boolean;     // Include in A2A consultation context
    anonymizeBeforeSharing: boolean;
  };
  
  // Revocation
  revocation?: {
    revokedAt: number;
    effect: "delete_all" | "stop_processing" | "keep_extracted";
  };
}
```

**Consent Flow**:
1. **First upload**: Explicit consent dialog
2. **Each upload**: Confirm purpose (context vs. records only)
3. **Settings page**: Granular control over processing
4. **Revocation**: One-click delete with cascading effects

### 5.3 Anonymization Pipeline

**Before A2A Consultation Context**:
```typescript
interface AnonymizationResult {
  // Entities removed or generalized
  redactedEntities: string[];
  
  // Transformations applied
  transformations: {
    entityId: string;
    original: string;
    anonymized: string;
    method: "remove" | "generalize" | "replace_with_type";
  }[];
  
  // Output for consultation
  anonymizedContext: string;
  
  // Reversibility (for user view)
  reversible: boolean;
  mappingKey?: string;           // User can view original
}
```

**Anonymization Rules**:
| Entity Type | Action | Example |
|-------------|--------|---------|
| Provider names | Generalize to specialty | "Dr. Smith" → "Cardiologist" |
| Facility names | Generalize to type | "General Hospital" → "Medical Center" |
| Dates | Relative to today | "2024-01-15" → "6 months ago" |
| Exact values | Range approximation | "7.2%" → "elevated range" |
| Patient identifiers | Remove entirely | MRN, insurance ID removed |

### 5.4 Audit Requirements

**Events Logged** (immutable, append-only):
```typescript
type DocumentAuditEvent =
  | { type: "document:uploaded"; documentId: string; userId: string; checksum: string }
  | { type: "document:validated"; documentId: string; result: "pass" | "fail"; reason?: string }
  | { type: "document:parsed"; documentId: string; parserVersion: string }
  | { type: "document:extracted"; documentId: string; entityCount: number }
  | { type: "document:correlated"; documentId: string; correlationId: string }
  | { type: "document:consulted"; documentId: string; consultationId: string; contextSize: number }
  | { type: "document:viewed"; documentId: string; userId: string; viewType: "full" | "extracted" }
  | { type: "document:deleted"; documentId: string; userId: string; reason: "user_request" | "retention" | "violation" }
  | { type: "document:consent_changed"; userId: string; change: string };
```

**Audit Trail Access**:
- User: Can view own audit trail
- Admin: Can view all (with justification)
- Compliance: Export capability for regulatory requests

### 5.5 Regulatory Considerations

| Regulation | Applicability | Controls |
|------------|---------------|----------|
| **China PIPL** | Primary jurisdiction | Explicit consent, purpose limitation, data minimization |
| **GDPR** | EU users | Right to deletion, portability, processing records |
| **HIPAA** | If handling US PHI | Business associate agreements, minimum necessary |
| **Medical Device** | Not a device | Wellness-only positioning; no diagnostic claims |

---

## 6. Risk Mitigation Strategies

### 6.1 Extraction Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OCR errors | High | Medium | Multi-engine OCR; confidence thresholds; user review prompts |
| Entity misclassification | Medium | High | Medical terminology validation; cross-reference with known terms |
| Context loss | High | Medium | Store original text alongside entities; provenance tracking |
| False positives | Medium | Medium | Confidence scoring; require multiple signals for critical entities |

**Quality Assurance Pipeline**:
```
Raw Extraction → Confidence Scoring → Quality Gates → Review Queue (if needed)
                     ↓
               User Feedback Loop → Model Improvement
```

### 6.2 Privacy Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data breach | Low | Critical | Encryption at rest/transit; access controls; minimal data retention |
| Unauthorized access | Low | High | Row-level security; user isolation; audit logging |
| Data residue | Medium | Medium | Secure deletion; overwrite before release; retention enforcement |
| Third-party exposure | Low | Critical | No external OCR services; local processing only |

### 6.3 Medical Liability Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Misinterpretation of data | Medium | High | Clear disclaimers; wellness framing only; no diagnostic output |
| Omission of critical info | Medium | High | Confidence warnings; "incomplete extraction" flags |
| Outdated information | Medium | Medium | Date validation; recency warnings; temporal context in consultation |
| False sense of security | Low | High | Emphasize professional consultation; no "all clear" messaging |

**Liability Protection Measures**:
1. **Clear disclaimers** on every extraction: "Extracted information may be incomplete or inaccurate"
2. **No diagnostic output**: Extracted data never presented as diagnostic interpretation
3. **Professional referral**: Always encourage professional consultation for health concerns
4. **User verification**: Flag low-confidence extractions for user review

### 6.4 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Processing failures | Medium | Medium | Retry logic; dead letter queue; graceful degradation |
| Storage exhaustion | Medium | Medium | Quotas; archiving; compression |
| Performance degradation | Medium | Low | Async processing; caching; resource limits |
| Format evolution | Low | Medium | Extensible parser architecture; versioned extraction |

### 6.5 Risk Response Matrix

```
                    IMPACT
              Low    Medium    High
           ┌────────┬────────┬────────┐
      High │Accept  │Reduce  │Reduce  │
L         ├────────┼────────┼────────┤
I   Medium │Accept  │Monitor │Reduce  │
K         ├────────┼────────┼────────┤
E      Low │Accept  │Accept  │Monitor │
L         └────────┴────────┴────────┘

Reduce: Implement controls (encryption, validation, review queues)
Monitor: Track metrics, alert on thresholds
Accept: Document and accept residual risk
```

---

## 7. Integration with Consultation Engine

### 7.1 HealthBrief Enhancement

**V2 Extended HealthBrief**:
```typescript
interface HealthBriefV2 extends HealthBrief {
  version: "2.0.0";
  
  // Document-derived context
  documentContext?: {
    // Documents included in this brief
    documentIds: string[];
    
    // Key entities relevant to current metrics
    relevantEntities: MedicalEntity[];
    
    // Timeline combining metrics and document events
    unifiedTimeline: TimelineEvent[];
    
    // Changes since last brief
    newDiagnoses: MedicalEntity[];
    newMedications: MedicalEntity[];
    newLabResults: MedicalEntity[];
  };
  
  // Correlation insights
  correlations?: {
    metricToDocument: CorrelationResult[];
    trendAnomalies: TrendAnomaly[];
  };
}
```

### 7.2 Consultation Context Enrichment

**Enhanced System Prompt** (when document context available):
```
User Health Context:

【Current Metrics】
- Weight: 75.5kg (BMI 24.2)
- Resting HR: 72 bpm
- Sleep: 6.5 hours/night average

【Recent Medical Records (Anonymized)】
- Physical exam (6 months ago): Blood pressure 120/80, general wellness
- Lab report (3 months ago): HbA1c 5.8% (prediabetic range), cholesterol normal
- Current medications: None reported

【Timeline】
- 6mo: Annual physical - all normal
- 3mo: Lab work showed elevated HbA1c
- 2mo: Started dietary changes
- Now: User asking about diabetes prevention

【User Question】
"What lifestyle changes actually work for preventing type 2 diabetes?"
```

### 7.3 Reaction Round Integration

Document-derived context enhances the reaction round:
- Agents can reference specific lab values (anonymized ranges)
- Consensus can incorporate documented medical history
- Divergence detection benefits from richer context

---

## 8. Migration Path from V1

### 8.1 Schema Compatibility

**Backward Compatibility Guarantee**:
- All V1 `HealthMetricType` values remain valid
- V1 health metrics continue to function without documents
- V2 document features are **opt-in**; no breaking changes

**Schema Evolution Strategy**:
```typescript
// V1 types remain unchanged
interface HealthMetricPoint { /* V1 definition */ }

// V2 adds parallel structures
interface DocumentEnrichedMetricPoint extends HealthMetricPoint {
  documentCorrelation?: DocumentCorrelation;
}

// Consultation record remains compatible
interface ConsultationRecord {
  // ... existing fields
  // New optional field
  documentContext?: DocumentContext;
}
```

### 8.2 Data Migration

**No migration required** for existing data:
- V1 metrics remain in existing KV keys
- V2 documents use new key prefixes
- No transformation of historical data

**Gradual Feature Rollout**:
| Phase | Feature | User Impact |
|-------|---------|-------------|
| 1 | Document upload only | Users can store documents; no extraction |
| 2 | Basic extraction | Extract dates, providers, document types |
| 3 | Full extraction | Medications, diagnoses, lab results |
| 4 | Correlation | Link to health metrics; consultation context |

### 8.3 API Compatibility

**Existing endpoints remain unchanged**:
- `POST /api/consultation` - Works with or without document IDs
- `GET /api/consultation/[id]` - Returns V1 structure; V2 fields optional

**New endpoints** (additive only):
- `POST /api/documents/upload`
- `GET /api/documents/[id]`
- `GET /api/documents/[id]/extraction`
- `DELETE /api/documents/[id]`

### 8.4 UI Compatibility

**Progressive Enhancement**:
- Existing pages work without document features
- New document management page is separate route
- Report page shows document context only when available

**Feature Detection**:
```typescript
// Client-side feature detection
const hasDocumentSupport = await checkFeatureFlag('v2-documents');
```

### 8.5 Rollback Plan

**Emergency Rollback**:
1. Disable document upload endpoints
2. Hide document UI components
3. Consultation engine falls back to metrics-only context
4. Stored documents remain but are not processed

**Rollback Triggers**:
- Extraction quality drops below 70% average
- Privacy incident or security concern
- Regulatory compliance issue
- Performance degradation (p95 > 5s for extraction)

---

## 9. Implementation Guidelines

### 9.1 Development Phases

**Phase 1: Foundation (Weeks 1-2)**
- Document upload and storage infrastructure
- Basic validation and security scanning
- PDF text extraction (native)

**Phase 2: OCR (Weeks 3-4)**
- Image preprocessing pipeline
- OCR integration (local engine)
- Quality gates and confidence scoring

**Phase 3: Extraction (Weeks 5-6)**
- Entity recognition models
- Medical terminology validation
- Relation extraction

**Phase 4: Integration (Weeks 7-8)**
- HealthBrief correlation
- Consultation context enrichment
- UI components

**Phase 5: Compliance (Weeks 9-10)**
- Audit logging
- Anonymization pipeline
- Consent management
- Security review

### 9.2 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OCR Engine | Local Tesseract | Privacy; no data leaves infrastructure |
| Storage | Vercel Blob + KV | Existing infrastructure; cost effective |
| Extraction | Rule-based + ML hybrid | Balance of accuracy and explainability |
| Correlation | Temporal + semantic | Captures both time-based and meaning-based links |
| Anonymization | Pre-consultation | Protects privacy; reduces liability |

### 9.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Upload success rate | >95% | Successful uploads / total attempts |
| Extraction confidence | >85% avg | Average entity confidence score |
| OCR accuracy | >90% | Correctly recognized words / total words (sampled) |
| Processing time | <30s p95 | Upload to extraction complete |
| User adoption | >20% of WAU | Users with ≥1 uploaded document |
| Consultation quality | +15% relevance | Measured by user feedback on document-enriched consultations |

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|------|------------|
| **OCR** | Optical Character Recognition - converting images of text to machine-readable text |
| **Entity** | A discrete piece of medical information (medication, diagnosis, etc.) |
| **Extraction** | The process of identifying and structuring entities from document text |
| **Provenance** | The complete history of where data came from and how it was processed |
| **Anonymization** | Removing or generalizing personally identifiable information |
| **HealthBrief** | Structured health data snapshot used to trigger consultations |

### 10.2 References

- V1 Health Data Policy: `docs/v1-health-data-policy.md`
- V1 Scope Definitions: `docs/v1-scope-in-out.md`
- HealthBrief Contract: `docs/health-brief-contract.md`
- Current DB Types: `web/src/lib/db/types.ts`

### 10.3 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0-draft | 2025-02-11 | Initial V2 architecture blueprint |

---

## 11. Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | | | ⬜ Pending |
| Legal Review | | | ⬜ Pending |
| Medical Advisor | | | ⬜ Pending |
| Security Review | | | ⬜ Pending |
| Engineering Lead | | | ⬜ Pending |
