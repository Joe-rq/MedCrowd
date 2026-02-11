# MedCrowd V2 Data Model Extensions

> **Status**: Architecture Blueprint  
> **Version**: 2.0.0-draft  
> **Date**: 2025-02-11  
> **Purpose**: Type definitions and schema extensions for medical document ingestion

---

## 1. Overview

This document defines the complete data model extensions required for V2 medical document ingestion. All extensions are additive to existing V1 types and maintain backward compatibility.

**Design Principles**:
- **Additive only**: No changes to existing V1 types
- **Explicit versioning**: All V2 types have version fields for future evolution
- **Provenance**: Every data point tracks its origin
- **Privacy by design**: Consent and audit trails built into core types

---

## 2. Core Type Extensions

### 2.1 Document Upload Types

```typescript
// web/src/lib/documents/types/upload.ts

/**
 * Document upload status lifecycle
 */
export type DocumentUploadStatus = 
  | "pending"           // Upload initiated, awaiting validation
  | "validating"        // Security and format validation in progress
  | "processing"        // Parsing and OCR in progress
  | "extracting"        // Entity extraction in progress
  | "extracted"         // Complete extraction available
  | "failed"            // Processing failed at some stage
  | "quarantined";      // Security concern, manual review required

/**
 * Supported document MIME types
 */
export type SupportedMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/tiff"
  | "application/hl7-v2"    // Future: HL7 messages
  | "application/fhir+json"; // Future: FHIR bundles

/**
 * Upload source channel
 */
export type UploadSource = "web" | "mobile" | "api" | "sync";

/**
 * Core document upload record
 * Stored in KV: doc:{userId}:upload:{docId}
 */
export interface DocumentUploadRecord {
  id: string;                    // Format: doc_{uuid}
  userId: string;
  status: DocumentUploadStatus;
  
  // Source metadata
  source: {
    filename: string;
    originalMimeType: string;
    detectedMimeType: SupportedMimeType | string;
    fileSizeBytes: number;
    uploadedAt: number;
    uploadedFrom: UploadSource;
    ipAddress?: string;          // Hashed for privacy
    userAgent?: string;
  };
  
  // Security
  security: {
    checksum: string;            // SHA-256 of file content
    encryptionKeyId: string;     // Reference to key management
    virusScanResult: "clean" | "infected" | "error";
    scannedAt?: number;
  };
  
  // Storage locations
  storage: {
    originalBlobUrl: string;     // Vercel Blob / S3 URL
    encryptedAtRest: boolean;
    compression?: string;        // "gzip", "none"
  };
  
  // Processing tracking
  processing: {
    attempts: number;
    lastAttemptAt?: number;
    stage?: string;              // Current processing stage
    error?: string;
    errorCode?: UploadErrorCode;
    errorAt?: number;
  };
  
  // Consent (captured at upload)
  consent: {
    grantedAt: number;
    purpose: DocumentPurpose[];
    retentionDays: number;
    processingConsented: boolean;
  };
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  expiresAt: number;             // Retention deadline
}

/**
 * Purpose for which document was uploaded
 */
export type DocumentPurpose = 
  | "consultation_context"    // Include in A2A consultation
  | "personal_records"        // Storage only, no processing
  | "anomaly_followup";       // Linked to specific health anomaly

/**
 * Upload error codes
 */
export type UploadErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "VIRUS_DETECTED"
  | "CORRUPT_FILE"
  | "ENCRYPTION_FAILED"
  | "STORAGE_ERROR"
  | "VALIDATION_TIMEOUT"
  | "OCR_FAILED"
  | "EXTRACTION_FAILED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED";
```

### 2.2 Document Classification Types

```typescript
// web/src/lib/documents/types/classification.ts

/**
 * Document type classification
 */
export type DocumentType =
  | "physical_exam"           // Annual physical, wellness check
  | "lab_report"              // Blood work, urinalysis
  | "imaging_report"          // Radiology reports
  | "discharge_summary"       // Hospital discharge
  | "progress_note"           // Visit/encounter notes
  | "operative_report"        // Surgery reports
  | "pathology_report"        // Lab pathology
  | "medication_list"         // Current medications
  | "immunization_record"     // Vaccination history
  | "insurance_form"          // Insurance/prior auth forms
  | "referral"                // Specialist referrals
  | "other";                  // Unclassified

/**
 * Medical specialty categories
 */
export type MedicalSpecialty =
  | "primary_care"
  | "cardiology"
  | "endocrinology"
  | "gastroenterology"
  | "nephrology"
  | "pulmonology"
  | "hematology"
  | "oncology"
  | "radiology"
  | "pathology"
  | "emergency"
  | "surgery"
  | "obstetrics_gynecology"
  | "pediatrics"
  | "psychiatry"
  | "unknown";

/**
 * Visit type classification
 */
export type VisitType = 
  | "annual_wellness"
  | "follow_up"
  | "urgent_care"
  | "emergency"
  | "specialist_consult"
  | "preoperative"
  | "postoperative"
  | "screening"
  | "unknown";

/**
 * Document classification result
 */
export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;            // 0-1
  
  // Specialization
  specialty?: MedicalSpecialty;
  specialtyConfidence?: number;
  
  // Visit context
  visitType?: VisitType;
  reportDate?: string;           // ISO 8601 date
  visitDate?: string;            // ISO 8601 date
  
  // Classification method
  method: "header_analysis" | "content_ml" | "hybrid" | "manual";
  modelVersion?: string;
  
  // Indicators found
  indicators: {
    hasVitalSigns: boolean;
    hasLabResults: boolean;
    hasMedications: boolean;
    hasDiagnoses: boolean;
    hasProcedures: boolean;
    hasImaging: boolean;
    hasProviderInfo: boolean;
  };
  
  // Quality
  quality: {
    textQuality: "high" | "medium" | "low";
    completeness: "complete" | "partial" | "fragment";
    requiresReview: boolean;
  };
}
```

### 2.3 Parsed Content Types

```typescript
// web/src/lib/documents/types/parsed.ts

/**
 * Parsed text content from document
 * Stored in KV: doc:{docId}:parsed
 */
export interface ParsedDocumentContent {
  id: string;                    // parse_{uuid}
  documentId: string;
  
  // Parsing metadata
  parserVersion: string;
  parsedAt: number;
  
  // Source information
  source: {
    originalMimeType: string;
    hadTextLayer: boolean;       // PDF had extractable text
    ocrRequired: boolean;
    ocrEngine?: string;          // "tesseract", "native"
  };
  
  // Content structure
  content: {
    fullText: string;            // Complete extracted text
    characterCount: number;
    wordCount: number;
    language: string;            // Detected language (ISO 639-1)
    
    // Page-level breakdown (for multi-page docs)
    pages?: ParsedPage[];
    
    // Detected sections
    sections?: ParsedSection[];
    
    // Detected tables
    tables?: ParsedTable[];
  };
  
  // OCR quality metrics
  ocrQuality?: OCRQualityMetrics;
  
  // Preprocessing applied
  preprocessing: {
    deskewed: boolean;
    denoised: boolean;
    contrastEnhanced: boolean;
    rotated?: number;            // Degrees rotated
  };
}

/**
 * Individual page content
 */
export interface ParsedPage {
  pageNumber: number;
  text: string;
  characterCount: number;
  hasImages: boolean;
  hasTables: boolean;
  ocrConfidence?: number;
}

/**
 * Detected section within document
 */
export interface ParsedSection {
  name: string;                  // "Assessment", "Medications", etc.
  startPosition: number;         // Character position in full text
  endPosition: number;
  pageNumber?: number;
  confidence: number;
}

/**
 * Extracted table structure
 */
export interface ParsedTable {
  id: string;
  pageNumber?: number;
  caption?: string;
  headers: string[];
  rows: string[][];
  boundingBox?: BoundingBox;
}

/**
 * Bounding box for positioning
 */
export interface BoundingBox {
  page?: number;
  x: number;                     // Top-left x
  y: number;                     // Top-left y
  width: number;
  height: number;
}

/**
 * OCR quality metrics
 */
export interface OCRQualityMetrics {
  overallConfidence: number;     // 0-1
  characterLevel: {
    meanConfidence: number;
    minConfidence: number;
    charactersUnder80: number;   // Count of low-confidence chars
  };
  wordLevel: {
    meanConfidence: number;
    wordsRecognized: number;
    dictionaryMatchRate: number; // % words in medical dictionary
  };
  issues: OCRIssue[];
}

/**
 * OCR detected issues
 */
export interface OCRIssue {
  type: "poor_contrast" | "skew" | "blur" | "handwriting" | "stain" | "tear";
  severity: "low" | "medium" | "high";
  pageNumber?: number;
  boundingBox?: BoundingBox;
  description: string;
}
```

### 2.4 Entity Extraction Types

```typescript
// web/src/lib/documents/types/entities.ts

import type { HealthMetricType } from "@/lib/db/types";

/**
 * All entity types extractable from medical documents
 */
export type EntityType =
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
  | "immunization"
  | "device"
  | "insurance"
  | "contact";

/**
 * Extraction method used
 */
export type ExtractionMethod = 
  | "rule"           // Regular expression / pattern matching
  | "dictionary"     // Term lookup in medical dictionaries
  | "ml"             // Machine learning model
  | "hybrid";        // Combination of methods

/**
 * Core medical entity interface
 */
export interface MedicalEntity {
  id: string;                    // ent_{uuid}
  type: EntityType;
  
  // Canonical representation (normalized)
  canonical: {
    name: string;
    code?: string;               // Standard code
    codeSystem?: CodeSystem;     // Coding system
    alternativeNames?: string[]; // Synonyms
  };
  
  // Original text reference
  text: {
    raw: string;                 // Exact text as appeared
    normalized: string;          // Lowercase, normalized
    start: number;               // Character position in parsed text
    end: number;
  };
  
  // Type-specific attributes
  attributes: EntityAttributes;
  
  // Extraction metadata
  extraction: {
    confidence: number;          // 0-1
    method: ExtractionMethod;
    modelVersion: string;
    extractedAt: number;
    validated: boolean;          // Passed validation rules
  };
  
  // Source provenance
  provenance: {
    documentId: string;
    parsedContentId: string;
    pageNumber?: number;
    section?: string;
    boundingBox?: BoundingBox;
  };
  
  // Temporal context
  temporal?: {
    isCurrent: boolean;          // Currently active/relevant
    startDate?: string;          // ISO 8601
    endDate?: string;
    dateQualifier?: "exact" | "approximate" | "unknown";
  };
  
  // Privacy
  privacy: {
    sensitivity: "low" | "medium" | "high" | "critical";
    anonymizedForConsultation: boolean;
  };
}

/**
 * Standard coding systems
 */
export type CodeSystem =
  | "ICD-10-CM"
  | "ICD-9-CM"
  | "SNOMED-CT"
  | "RxNorm"
  | "NDC"
  | "CPT"
  | "HCPCS"
  | "LOINC"
  | "CVX"              // Vaccines
  | "UNII"             // Substances
  | "internal";        // Internal code

/**
 * Union of all entity attribute types
 */
export type EntityAttributes =
  | MedicationAttributes
  | DiagnosisAttributes
  | ProcedureAttributes
  | LabResultAttributes
  | VitalSignAttributes
  | ProviderAttributes
  | FacilityAttributes
  | AllergyAttributes
  | ImmunizationAttributes;

/**
 * Medication entity attributes
 */
export interface MedicationAttributes {
  dosage?: {
    value: number;
    unit: string;
    text?: string;             // Original text (e.g., "500mg")
  };
  frequency?: string;
  route?: string;
  prescribedDate?: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "discontinued" | "completed" | "on_hold" | "unknown";
  prescribedBy?: string;       // Provider ID reference
  pharmacy?: string;
  refills?: number;
  quantity?: string;
  instructions?: string;
  genericName?: string;
  brandName?: string;
}

/**
 * Diagnosis/condition entity attributes
 */
export interface DiagnosisAttributes {
  icd10Code?: string;
  icd9Code?: string;
  snomedCode?: string;
  status: "active" | "resolved" | "chronic" | "history_of" | "suspected" | "ruled_out";
  onsetDate?: string;
  resolutionDate?: string;
  severity?: "mild" | "moderate" | "severe" | "unknown";
  acuity?: "acute" | "chronic" | "acute_on_chronic";
  laterality?: "left" | "right" | "bilateral" | "unknown";
  stage?: string;              // Cancer staging, etc.
  isPrimary?: boolean;         // Primary vs. secondary diagnosis
}

/**
 * Procedure entity attributes
 */
export interface ProcedureAttributes {
  cptCode?: string;
  hcpcsCode?: string;
  snomedCode?: string;
  date?: string;
  status: "completed" | "scheduled" | "cancelled" | "in_progress" | "unknown";
  result?: string;
  indication?: string;         // Why procedure was done
  findings?: string;
  orderingProvider?: string;   // Provider ID
  performingProvider?: string;
  facility?: string;           // Facility ID
  anesthesia?: string;
  complications?: string;
}

/**
 * Lab result entity attributes
 */
export interface LabResultAttributes {
  loincCode?: string;          // Logical Observation Identifiers
  testName: string;
  value: number | string;
  numericValue?: number;
  unit: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
    isApproximate?: boolean;
  };
  interpretation?: LabInterpretation;
  collectedDate?: string;
  resultedDate?: string;
  specimenType?: string;
  performingLab?: string;
  method?: string;
  note?: string;
}

/**
 * Lab result interpretation values
 */
export type LabInterpretation =
  | "normal"
  | "abnormal"
  | "high"
  | "low"
  | "critical_high"
  | "critical_low"
  | "positive"
  | "negative"
  | "borderline"
  | "unknown";

/**
 * Vital sign entity attributes
 */
export interface VitalSignAttributes {
  vitalType: VitalType;
  value: number;
  unit: string;
  
  // Blood pressure specific
  systolic?: number;
  diastolic?: number;
  
  // Context
  position?: "sitting" | "standing" | "supine" | "lying" | "unknown";
  location?: "left_arm" | "right_arm" | "left_leg" | "right_leg" | "unknown";
  device?: string;
  
  // Timing
  measuredDate?: string;
  timeOfDay?: "morning" | "afternoon" | "evening" | "unknown";
  
  // Relation to health metrics
  mapsToMetric?: HealthMetricType;
}

/**
 * Vital sign types
 */
export type VitalType =
  | "blood_pressure"
  | "heart_rate"
  | "pulse"
  | "respiratory_rate"
  | "temperature"
  | "oxygen_saturation"
  | "weight"
  | "height"
  | "bmi"
  | "head_circumference"
  | "pain_score"
  | "blood_glucose"
  | "peak_flow";

/**
 * Provider entity attributes
 */
export interface ProviderAttributes {
  fullName: string;
  firstName?: string;
  lastName?: string;
  credentials?: string[];      // MD, DO, NP, PA, etc.
  specialty?: MedicalSpecialty;
  npi?: string;                // National Provider Identifier
  phone?: string;
  fax?: string;
  email?: string;
  address?: Address;
  facility?: string;           // Facility ID reference
  role?: "primary" | "referring" | "consulting" | "attending" | "unknown";
}

/**
 * Facility entity attributes
 */
export interface FacilityAttributes {
  name: string;
  type?: "hospital" | "clinic" | "lab" | "pharmacy" | "imaging_center" | "unknown";
  npi?: string;
  phone?: string;
  address?: Address;
  department?: string;
}

/**
 * Address structure
 */
export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Allergy/intolerance attributes
 */
export interface AllergyAttributes {
  allergen: string;
  allergenCode?: string;
  codeSystem?: "RxNorm" | "UNII" | "internal";
  reaction?: string;
  severity?: "mild" | "moderate" | "severe" | "life_threatening" | "unknown";
  onsetDate?: string;
  status: "active" | "resolved" | "unknown";
  verified?: boolean;
}

/**
 * Immunization attributes
 */
export interface ImmunizationAttributes {
  vaccine: string;
  cvxCode?: string;            // CDC vaccine code
  manufacturer?: string;
  lotNumber?: string;
  date: string;
  route?: string;
  site?: string;
  status: "completed" | "entered_in_error" | "not_done";
  wasGiven?: boolean;
  reasonNotGiven?: string;
}
```

### 2.5 Relation Types

```typescript
// web/src/lib/documents/types/relations.ts

/**
 * Relation types between entities
 */
export type RelationType =
  | "treats"              // Medication treats Diagnosis
  | "indicates"           // LabResult indicates Diagnosis
  | "ordered_for"         // Procedure ordered_for Diagnosis
  | "performed_by"        // Procedure performed_by Provider
  | "prescribed_by"       // Medication prescribed_by Provider
  | "measured_at"         // VitalSign measured_at Date
  | "result_of"           // LabResult result_of Procedure
  | "administered_at"     // Immunization administered_at Facility
  | "associated_with"     // Generic association
  | "caused_by"           // Symptom caused_by Diagnosis
  | "contraindicated_for"; // Allergy contraindicated_for Medication

/**
 * Relation between two entities
 */
export interface EntityRelation {
  id: string;                    // rel_{uuid}
  type: RelationType;
  
  sourceEntityId: string;
  targetEntityId: string;
  
  // Directionality
  isDirected: boolean;
  
  // Confidence
  confidence: number;
  
  // Context
  context: {
    text: string;                // Supporting text snippet
    documentId: string;
    pageNumber?: number;
    section?: string;
  };
  
  // Temporal
  temporal?: {
    validFrom?: string;
    validUntil?: string;
  };
  
  // Extraction metadata
  extraction: {
    method: ExtractionMethod;
    modelVersion: string;
    extractedAt: number;
  };
}
```

### 2.6 Extraction Result Types

```typescript
// web/src/lib/documents/types/extraction.ts

import type { MedicalEntity, EntityRelation } from "./entities";
import type { DocumentClassification } from "./classification";

/**
 * Complete extraction result for a document
 * Stored in KV: doc:{docId}:extract
 */
export interface DocumentExtraction {
  id: string;                    // extract_{uuid}
  documentId: string;
  userId: string;
  
  // Version
  extractionVersion: string;     // "2.0.0"
  
  // Timing
  extractedAt: number;
  processingDurationMs: number;
  
  // Classification
  classification: DocumentClassification;
  
  // Extracted content
  entities: MedicalEntity[];
  relations: EntityRelation[];
  
  // Document-level metadata
  documentMetadata: {
    patientName?: string;        // Extracted but not stored (privacy)
    patientDateOfBirth?: string; // Extracted but not stored
    medicalRecordNumber?: string; // Extracted but not stored
    reportDate?: string;
    orderingProvider?: string;
    primaryProvider?: string;
  };
  
  // Statistics
  statistics: ExtractionStatistics;
  
  // Quality assessment
  quality: ExtractionQuality;
  
  // Timeline of events in document
  timeline: TimelineEvent[];
  
  // Provenance
  provenance: {
    uploadId: string;
    parsedContentId: string;
    extractionPipelineVersion: string;
  };
}

/**
 * Extraction statistics
 */
export interface ExtractionStatistics {
  totalEntities: number;
  byType: Record<EntityType, number>;
  totalRelations: number;
  byRelationType: Record<RelationType, number>;
  
  averageEntityConfidence: number;
  minEntityConfidence: number;
  maxEntityConfidence: number;
  
  lowConfidenceEntityCount: number;
  entitiesRequiringReview: number;
}

/**
 * Extraction quality assessment
 */
export interface ExtractionQuality {
  overall: "high" | "medium" | "low";
  
  // Component scores
  scores: {
    ocrQuality: number;
    entityRecognition: number;
    normalization: number;
    contextValidation: number;
  };
  
  // Issues
  concerns: QualityConcern[];
  
  // Flags
  requiresReview: boolean;
  isPartialExtraction: boolean;
  hasCriticalErrors: boolean;
}

/**
 * Quality concern
 */
export interface QualityConcern {
  severity: "info" | "warning" | "critical";
  category: "ocr" | "extraction" | "validation" | "correlation";
  message: string;
  entityIds?: string[];          // Related entities
}

/**
 * Timeline event from document
 */
export interface TimelineEvent {
  id: string;
  date: string;                  // ISO 8601
  datePrecision: "exact" | "day" | "month" | "year" | "approximate";
  
  type: "visit" | "procedure" | "lab" | "medication_start" | "medication_end" | "diagnosis" | "other";
  
  title: string;
  description?: string;
  
  // Linked entities
  entityIds: string[];
  
  // Source
  sourceDocumentId: string;
  pageNumber?: number;
}
```

---

## 3. Correlation and Integration Types

### 3.1 Metric Correlation Types

```typescript
// web/src/lib/documents/types/correlation.ts

import type { HealthMetricPoint, HealthMetricType } from "@/lib/db/types";
import type { MedicalEntity } from "./entities";

/**
 * Correlation between extracted entity and health metric
 */
export interface MetricEntityCorrelation {
  id: string;                    // corr_{uuid}
  
  // References
  entityId: string;
  metricType: HealthMetricType;
  metricTimestamp: number;
  
  // Correlation type
  type: CorrelationType;
  
  // Temporal relationship
  temporalRelationship: TemporalRelationship;
  
  // Semantic similarity
  semanticScore?: number;
  
  // Overall confidence
  confidence: number;
  
  // Explanation
  explanation: string;
  
  // Computed
  computedAt: number;
}

/**
 * Types of correlations
 */
export type CorrelationType =
  | "temporal_exact"      // Same timestamp
  | "temporal_near"       // Within 24 hours
  | "semantic_equivalent" // Same concept (e.g., "weight" vs "体重")
  | "explicit_reference"  // Document mentions metric explicitly
  | "inferred_context";   // Inferred from surrounding context

/**
 * Temporal relationship
 */
export interface TemporalRelationship {
  metricDate: number;
  entityDate?: number;
  daysDifference: number;
  relationship: "same_day" | "within_week" | "within_month" | "before" | "after" | "unknown";
}

/**
 * Unified health context combining metrics and documents
 */
export interface UnifiedHealthContext {
  userId: string;
  generatedAt: number;
  
  // Time window
  windowStart: number;
  windowEnd: number;
  
  // Combined timeline
  timeline: HealthTimelineEvent[];
  
  // Metrics in window
  metrics: HealthMetricPoint[];
  
  // Documents in window
  documents: DocumentSummary[];
  
  // Extracted entities in window
  entities: MedicalEntity[];
  
  // Correlations
  correlations: MetricEntityCorrelation[];
  
  // Insights
  insights: HealthInsight[];
}

/**
 * Health timeline event (unified view)
 */
export interface HealthTimelineEvent {
  id: string;
  timestamp: number;
  type: "metric" | "document" | "entity" | "consultation";
  
  // Source reference
  sourceType: "health_metric" | "medical_document" | "extracted_entity" | "consultation";
  sourceId: string;
  
  // Display
  title: string;
  description: string;
  category: HealthMetricType | EntityType | "consultation";
  
  // Value (if applicable)
  value?: number | string;
  unit?: string;
  
  // Context
  context?: string;
}

/**
 * Document summary for context views
 */
export interface DocumentSummary {
  id: string;
  documentType: DocumentType;
  reportDate?: string;
  facility?: string;
  provider?: string;
  keyFindings: string[];
  extractionConfidence: number;
}

/**
 * Health insight from correlation analysis
 */
export interface HealthInsight {
  id: string;
  type: "trend" | "anomaly" | "correlation" | "suggestion";
  severity: "info" | "positive" | "warning" | "attention";
  
  title: string;
  description: string;
  
  // Supporting evidence
  evidence: {
    metricIds?: string[];
    documentIds?: string[];
    entityIds?: string[];
  };
  
  // Recommended action
  suggestedAction?: string;
}
```

### 3.2 Consultation Integration Types

```typescript
// web/src/lib/documents/types/consultation.ts

import type { MedicalEntity } from "./entities";
import type { HealthMetricPoint } from "@/lib/db/types";

/**
 * Extended HealthBrief with document context
 * Extends HealthBrief from health-brief/types.ts
 */
export interface HealthBriefV2 {
  // V1 fields (inherited)
  id: string;
  userId: string;
  version: "2.0.0";
  status: HealthBriefStatus;
  metrics: HealthBriefMetric[];
  anomalies: Anomaly[];
  maxSeverity: AnomalySeverity | null;
  policyVersion: PolicyVersion;
  appliedPolicy: TriggerPolicy;
  triggerDecision: {
    shouldTrigger: boolean;
    reason: string;
    triggeredAt?: number;
  };
  consultationId?: string;
  createdAt: number;
  updatedAt: number;
  
  // V2 additions
  documentContext?: DocumentContext;
  correlations?: CorrelationContext;
}

/**
 * Document context for consultation
 */
export interface DocumentContext {
  // Documents included
  documentIds: string[];
  summary: string;               // Human-readable summary
  
  // Key entities relevant to current metrics
  relevantEntities: MedicalEntity[];
  
  // New diagnoses since last consultation
  newDiagnoses: MedicalEntity[];
  
  // New medications since last consultation
  newMedications: MedicalEntity[];
  
  // Recent lab results
  recentLabResults: MedicalEntity[];
  
  // Timeline combining metrics and documents
  unifiedTimeline: HealthTimelineEvent[];
}

/**
 * Correlation context
 */
export interface CorrelationContext {
  // Metric-to-document correlations
  metricCorrelations: MetricEntityCorrelation[];
  
  // Notable trends detected
  trendAnomalies: TrendAnomaly[];
  
  // Synthesis for consultation
  synthesis: string;
}

/**
 * Trend anomaly detected across metrics and documents
 */
export interface TrendAnomaly {
  id: string;
  type: "metric_only" | "document_only" | "correlated";
  
  // Description
  description: string;
  detectedAt: number;
  
  // Related data
  relatedMetrics: HealthMetricPoint[];
  relatedEntities: MedicalEntity[];
  relatedDocuments: string[];
  
  // Severity
  severity: "mild" | "moderate" | "attention";
}

/**
 * Anonymized context for A2A consultation
 */
export interface AnonymizedDocumentContext {
  // Original context hashed/removed
  originalContextHash: string;
  
  // Anonymized summary
  summary: string;
  
  // Generalized entities (no specific dates, names, exact values)
  generalizedEntities: GeneralizedEntity[];
  
  // Temporal context (relative)
  relativeTimeline: RelativeTimelineEvent[];
  
  // Transformations applied
  transformations: AnonymizationTransformation[];
}

/**
 * Generalized entity for consultation
 */
export interface GeneralizedEntity {
  type: EntityType;
  generalDescription: string;    // e.g., "blood pressure medication" not "Lisinopril"
  category: string;
  timeContext: "current" | "recent" | "past" | "unknown";
}

/**
 * Relative timeline event
 */
export interface RelativeTimelineEvent {
  relativeTime: "current" | "recent" | "6_months_ago" | "1_year_ago";
  description: string;
  category: string;
}

/**
 * Anonymization transformation record
 */
export interface AnonymizationTransformation {
  entityId: string;
  originalType: "date" | "name" | "value" | "identifier";
  transformation: "generalized" | "relative_date" | "removed" | "categorized";
  reversible: boolean;
}
```

---

## 4. Consent and Audit Types

### 4.1 Consent Management Types

```typescript
// web/src/lib/documents/types/consent.ts

/**
 * Document processing consent
 * Stored in KV: consent:{userId}:documents
 */
export interface DocumentConsent {
  userId: string;
  version: "2.0.0";
  
  // When consent was granted
  grantedAt: number;
  updatedAt: number;
  
  // Granular consent settings
  permissions: {
    upload: boolean;
    ocrProcessing: boolean;
    entityExtraction: boolean;
    metricCorrelation: boolean;
    consultationContext: boolean;
    shareWithAgents: boolean;
  };
  
  // Purposes consented to
  purposes: DocumentPurpose[];
  
  // Retention preference
  retentionDays: number;         // Default: 90
  
  // Anonymization preference
  anonymization: {
    enabled: boolean;
    level: "none" | "minimal" | "standard" | "maximum";
  };
  
  // Revocation
  revocation?: ConsentRevocation;
}

/**
 * Consent revocation record
 */
export interface ConsentRevocation {
  revokedAt: number;
  reason?: string;
  effect: RevocationEffect;
  processedAt?: number;
}

/**
 * Effect of revocation
 */
export type RevocationEffect =
  | "delete_all"                 // Delete all documents and extractions
  | "stop_processing"            // Keep existing, stop new processing
  | "keep_extracted_only"        // Keep extractions, delete documents
  | "anonymize";                 // Anonymize instead of delete

/**
 * Per-document consent override
 */
export interface DocumentConsentOverride {
  documentId: string;
  userId: string;
  
  // Override global settings
  permissions?: Partial<DocumentConsent["permissions"]>;
  purposes?: DocumentPurpose[];
  retentionDays?: number;
  
  // Document-specific settings
  excludeFromConsultation: boolean;
  excludeFromCorrelation: boolean;
  
  setAt: number;
}
```

### 4.2 Audit Event Types

```typescript
// web/src/lib/documents/types/audit.ts

/**
 * Document audit event types
 */
export type DocumentAuditEventType =
  // Upload lifecycle
  | "document:uploaded"
  | "document:validated"
  | "document:parsed"
  | "document:extracted"
  | "document:correlated"
  | "document:consulted"
  
  // User actions
  | "document:viewed"
  | "document:downloaded"
  | "document:shared"
  | "document:deleted"
  
  // Consent events
  | "document:consent_granted"
  | "document:consent_updated"
  | "document:consent_revoked"
  
  // System events
  | "document:retention_enforced"
  | "document:anonymized"
  | "document:quarantined"
  | "document:failed_processing";

/**
 * Document audit event
 * Stored in KV: doc:{userId}:audit (list) and doc:audit:{timestamp}:{eventId}
 */
export interface DocumentAuditEvent {
  id: string;                    // audit_{uuid}
  type: DocumentAuditEventType;
  
  // When
  timestamp: number;
  
  // Who
  userId: string;
  actorType: "user" | "system" | "admin";
  actorId: string;
  
  // What
  documentId?: string;
  details: AuditEventDetails;
  
  // Context
  ipAddress?: string;            // Hashed
  userAgent?: string;
  sessionId?: string;
}

/**
 * Audit event details (type-specific)
 */
export type AuditEventDetails =
  | UploadDetails
  | ValidationDetails
  | ProcessingDetails
  | ExtractionDetails
  | ConsultationDetails
  | UserActionDetails
  | ConsentDetails
  | SystemDetails;

export interface UploadDetails {
  filename: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
}

export interface ValidationDetails {
  result: "pass" | "fail";
  stage: string;
  reason?: string;
}

export interface ProcessingDetails {
  stage: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ExtractionDetails {
  entityCount: number;
  averageConfidence: number;
  requiresReview: boolean;
}

export interface ConsultationDetails {
  consultationId: string;
  contextSize: number;
  entityTypesIncluded: string[];
}

export interface UserActionDetails {
  action: "view" | "download" | "share" | "delete";
  viewType?: "full" | "extracted" | "original";
}

export interface ConsentDetails {
  change: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface SystemDetails {
  operation: string;
  reason: string;
  automated: boolean;
}
```

---

## 5. KV Storage Schema

### 5.1 Extended KV Keys

```typescript
// web/src/lib/documents/types/keys.ts

/**
 * Document storage KV key schema
 * Extends existing KV_KEYS from @/lib/db/types
 */
export const DOCUMENT_KV_KEYS = {
  // Document upload records
  upload: (userId: string, docId: string) =>
    `doc:${userId}:upload:${docId}`,
  
  // User's document list (sorted set by upload time)
  userDocuments: (userId: string) =>
    `doc:${userId}:list`,
  
  // User documents by status (for processing queues)
  userDocumentsByStatus: (userId: string, status: DocumentUploadStatus) =>
    `doc:${userId}:status:${status}`,
  
  // Parsed content
  parsedContent: (docId: string) =>
    `doc:${docId}:parsed`,
  
  // Extraction result
  extraction: (docId: string) =>
    `doc:${docId}:extract`,
  
  // User entity index (for quick lookups)
  userEntities: (userId: string, entityType: string) =>
    `doc:${userId}:entities:${entityType}`,
  
  // User timeline index
  userTimeline: (userId: string) =>
    `doc:${userId}:timeline`,
  
  // Correlations
  correlations: (userId: string) =>
    `doc:${userId}:correlations`,
  
  // Consent
  consent: (userId: string) =>
    `consent:${userId}:documents`,
  
  // Per-document consent override
  documentConsent: (docId: string) =>
    `doc:${docId}:consent`,
  
  // Audit
  auditEvent: (timestamp: number, eventId: string) =>
    `doc:audit:${timestamp}:${eventId}`,
  
  userAudit: (userId: string) =>
    `doc:${userId}:audit`,
  
  // Processing queues
  processingQueue: (priority: "high" | "normal" | "low") =>
    `doc:queue:processing:${priority}`,
  
  extractionQueue: (priority: "high" | "normal" | "low") =>
    `doc:queue:extraction:${priority}`,
  
  // Stats and metrics
  processingStats: (date: string) =>
    `doc:stats:processing:${date}`,
  
  userStats: (userId: string) =>
    `doc:${userId}:stats`,
} as const;
```

### 5.2 Storage Metadata

```typescript
// web/src/lib/documents/types/storage.ts

/**
 * Document storage metadata
 */
export interface DocumentStorageMetadata {
  documentId: string;
  userId: string;
  
  // Storage locations
  locations: {
    original: {
      type: "vercel_blob" | "s3" | "local";
      url: string;
      size: number;
      checksum: string;
    };
    parsed?: {
      key: string;
      size: number;
    };
    extraction?: {
      key: string;
      size: number;
    };
  };
  
  // Encryption
  encryption: {
    algorithm: "AES-256-GCM";
    keyId: string;
    encryptedAt: number;
  };
  
  // Retention
  retention: {
    uploadedAt: number;
    expiresAt: number;
    autoDelete: boolean;
  };
}
```

---

## 6. API Types

### 6.1 Request/Response Types

```typescript
// web/src/lib/documents/types/api.ts

import type { DocumentUploadStatus, DocumentType } from "./upload";
import type { MedicalEntity } from "./entities";

/**
 * Upload document request
 */
export interface UploadDocumentRequest {
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  purpose: DocumentPurpose[];
}

/**
 * Upload document response
 */
export interface UploadDocumentResponse {
  documentId: string;
  uploadUrl: string;             // Pre-signed URL for direct upload
  expiresAt: number;
  maxSize: number;
  allowedTypes: string[];
}

/**
 * Document list item
 */
export interface DocumentListItem {
  id: string;
  filename: string;
  documentType?: DocumentType;
  status: DocumentUploadStatus;
  uploadedAt: number;
  fileSize: number;
  reportDate?: string;
  entityCount?: number;
  extractionConfidence?: number;
}

/**
 * Get document response
 */
export interface GetDocumentResponse {
  id: string;
  filename: string;
  status: DocumentUploadStatus;
  source: {
    mimeType: string;
    fileSize: number;
    uploadedAt: number;
  };
  classification?: {
    documentType: DocumentType;
    confidence: number;
    reportDate?: string;
  };
  extraction?: {
    extractedAt: number;
    entityCount: number;
    confidence: number;
    requiresReview: boolean;
  };
  downloadUrl?: string;          // Time-limited download URL
}

/**
 * Get extraction response
 */
export interface GetExtractionResponse {
  documentId: string;
  extractedAt: number;
  version: string;
  
  classification: {
    documentType: DocumentType;
    specialty?: string;
    reportDate?: string;
    confidence: number;
  };
  
  entities: MedicalEntity[];
  
  statistics: {
    totalEntities: number;
    byType: Record<string, number>;
    averageConfidence: number;
  };
  
  quality: {
    overall: "high" | "medium" | "low";
    requiresReview: boolean;
    concerns: string[];
  };
  
  timeline: TimelineEvent[];
}

/**
 * Delete document request
 */
export interface DeleteDocumentRequest {
  reason?: string;
  cascade: boolean;              // Also delete extractions
}

/**
 * Consent update request
 */
export interface UpdateConsentRequest {
  permissions?: Partial<{
    upload: boolean;
    ocrProcessing: boolean;
    entityExtraction: boolean;
    metricCorrelation: boolean;
    consultationContext: boolean;
    shareWithAgents: boolean;
  }>;
  retentionDays?: number;
  anonymization?: {
    enabled: boolean;
    level: "none" | "minimal" | "standard" | "maximum";
  };
}

/**
 * Health context response
 */
export interface GetHealthContextResponse {
  userId: string;
  generatedAt: number;
  
  window: {
    start: string;               // ISO 8601
    end: string;
  };
  
  summary: {
    metricCount: number;
    documentCount: number;
    entityCount: number;
    correlationCount: number;
  };
  
  timeline: HealthTimelineEvent[];
  insights: HealthInsight[];
}
```

---

## 7. Configuration Types

### 7.1 Pipeline Configuration

```typescript
// web/src/lib/documents/types/config.ts

/**
 * Document processing configuration
 */
export interface DocumentProcessingConfig {
  // Upload limits
  upload: {
    maxFileSizeBytes: number;      // 10MB
    maxFilesPerUser: number;       // 50
    maxDailyUploads: number;       // 10
    maxFileAgeYears: number;       // 5
    allowedMimeTypes: string[];
  };
  
  // Validation
  validation: {
    virusScan: boolean;
    checksumVerify: boolean;
    duplicateDetection: boolean;
  };
  
  // OCR
  ocr: {
    engine: "tesseract" | "native";
    languages: string[];
    preprocessing: {
      deskew: boolean;
      denoise: boolean;
      enhanceContrast: boolean;
    };
  };
  
  // Extraction
  extraction: {
    entityTypes: EntityType[];
    codeSystems: string[];
    confidenceThreshold: number;   // 0.7
    requireReviewThreshold: number; // 0.5
  };
  
  // Quality gates
  qualityGates: {
    ocr: {
      minCharacterConfidence: number;
      minWordConfidence: number;
      minOverallConfidence: number;
    };
    extraction: {
      minEntityConfidence: number;
      maxUnknownEntities: number;
    };
  };
  
  // Retention
  retention: {
    documentDays: number;          // 90
    extractionDays: number;        // 365
    auditDays: number;             // 2555 (7 years)
  };
  
  // Anonymization
  anonymization: {
    enabled: boolean;
    removeIdentifiers: boolean;
    generalizeDates: boolean;
    generalizeValues: boolean;
  };
}
```

---

## 8. Migration from V1

### 8.1 Compatibility Matrix

| V1 Type | V2 Status | Notes |
|---------|-----------|-------|
| `HealthMetricType` | ✅ Unchanged | V1 types remain valid |
| `HealthMetricPoint` | ✅ Unchanged | Extended via composition |
| `HealthBrief` | ✅ Extended | V2 adds optional `documentContext` |
| `ConsultationRecord` | ✅ Compatible | New optional fields only |
| `KV_KEYS` | ✅ Extended | New keys in `DOCUMENT_KV_KEYS` |

### 8.2 Type Composition Pattern

```typescript
// Example: Extending V1 types without modification

// V1 type (unchanged)
interface HealthBrief { /* ... */ }

// V2 composition
interface HealthBriefV2 extends Omit<HealthBrief, "version"> {
  version: "2.0.0";
  documentContext?: DocumentContext;
}

// Usage: Can use V1 or V2 interchangeably where version not checked
function processBrief(brief: HealthBrief | HealthBriefV2) {
  // Common fields work for both
  const { id, userId, metrics, anomalies } = brief;
  
  // V2-specific handling
  if (brief.version === "2.0.0" && "documentContext" in brief) {
    // Handle document context
  }
}
```

---

## 9. File Organization

```
web/src/lib/documents/
├── types/
│   ├── index.ts              # Re-exports all types
│   ├── upload.ts             # Upload and status types
│   ├── classification.ts     # Document classification
│   ├── parsed.ts             # Parsed content types
│   ├── entities.ts           # Medical entity types
│   ├── relations.ts          # Entity relations
│   ├── extraction.ts         # Extraction results
│   ├── correlation.ts        # Metric correlation
│   ├── consultation.ts       # Consultation integration
│   ├── consent.ts            # Consent management
│   ├── audit.ts              # Audit events
│   ├── keys.ts               # KV key schema
│   ├── storage.ts            # Storage metadata
│   ├── api.ts                # API request/response
│   └── config.ts             # Configuration
└── README.md                 # Module documentation
```

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0-draft | 2025-02-11 | Initial V2 data model extensions |
