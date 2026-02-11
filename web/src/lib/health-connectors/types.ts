// Health Connector Type Definitions
// Tier A/B/C fallback strategy for V1 health metrics ingestion

import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

// Connector capability tiers
export type ConnectorTier = "A" | "B" | "C";

// Connector availability status
export interface ConnectorStatus {
  available: boolean;
  lastChecked: number;
  error?: string;
  latencyMs?: number;
}

// Supported metric types per connector
export interface ConnectorCapabilities {
  metrics: HealthMetricType[];
  features: readonly ConnectorFeature[];
}

export type ConnectorFeature =
  | "batch_upload"
  | "real_time"
  | "historical_sync"
  | "automatic_sync"
  | "manual_entry";

// Base connector interface - all tiers implement this
export interface HealthConnector {
  readonly id: string;
  readonly name: string;
  readonly tier: ConnectorTier;
  readonly capabilities: ConnectorCapabilities;

  // Check if connector is available for this user
  checkAvailability(userId: string): Promise<ConnectorStatus>;

  // Ingest metrics - returns normalized points
  ingest(
    userId: string,
    metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult>;

  // Batch ingestion support
  ingestBatch?(
    userId: string,
    items: IngestionBatchItem[]
  ): Promise<BatchIngestionResult>;
}

// Ingestion result from a connector
export interface IngestionResult {
  success: boolean;
  points: HealthMetricPoint[];
  rejected: RejectedMetric[];
  metadata: IngestionMetadata;
}

export interface IngestionBatchItem {
  metricType: HealthMetricType;
  rawData: unknown;
}

export interface BatchIngestionResult {
  success: boolean;
  totalProcessed: number;
  totalRejected: number;
  results: IngestionResult[];
}

export interface RejectedMetric {
  reason: string;
  rawData: unknown;
  timestamp: number;
}

export interface IngestionMetadata {
  source: string;
  connectorId: string;
  processedAt: number;
  latencyMs: number;
  deduplicatedCount: number;
}

// Tier A: Direct device/platform integrations (e.g., Apple HealthKit)
export interface TierAConnector extends HealthConnector {
  readonly tier: "A";

  // OAuth/token management for platform access
  validateAccessToken(userId: string): Promise<boolean>;
  refreshAccessToken?(userId: string): Promise<boolean>;

  // HealthKit-style query interface
  queryHealthData?(
    userId: string,
    metricType: HealthMetricType,
    startTime: number,
    endTime: number
  ): Promise<HealthMetricPoint[]>;
}

// Tier B: Aggregator APIs (e.g., Google Fit, Withings API)
export interface TierBConnector extends HealthConnector {
  readonly tier: "B";

  // Polling-based sync
  syncSince(userId: string, since: number): Promise<IngestionResult>;
}

// Tier C: Manual entry / file upload fallback
export interface TierCConnector extends HealthConnector {
  readonly tier: "C";

  // CSV/JSON file import
  importFile?(
    userId: string,
    file: File,
    mapping: FieldMapping
  ): Promise<IngestionResult>;

  // Single manual entry
  addManualEntry(
    userId: string,
    metricType: HealthMetricType,
    value: number,
    unit: string,
    timestamp: number,
    notes?: string
  ): Promise<HealthMetricPoint>;
}

// Field mapping for file imports
export interface FieldMapping {
  timestamp: string;
  value: string;
  unit?: string;
  source?: string;
  timestampFormat?: string;
}

// Connector registry entry
export interface ConnectorRegistryEntry {
  id: string;
  name: string;
  tier: ConnectorTier;
  factory: () => HealthConnector;
  priority: number; // Lower = higher priority within tier
}

// Fallback strategy configuration
export interface FallbackConfig {
  tiers: ConnectorTier[];
  timeoutMs: number;
  retryAttempts: number;
  allowPartial: boolean;
}

// Default fallback: Try A → B → C
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  tiers: ["A", "B", "C"],
  timeoutMs: 30000,
  retryAttempts: 1,
  allowPartial: true,
};

// Deduplication configuration
export interface DeduplicationConfig {
  // Time window in ms for considering duplicates (default: 5 minutes)
  windowMs: number;
  // Fields to compare for equality
  fields: ("timestamp" | "value" | "source")[];
  // Tolerance for value comparison (for floating point)
  valueTolerance: number;
}

export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  fields: ["timestamp", "value", "source"],
  valueTolerance: 0.001,
};

// Ingestion request from API
export interface IngestionRequest {
  userId: string;
  source: string;
  metricType: HealthMetricType;
  data: unknown;
  timestamp?: number;
  options?: IngestionOptions;
}

export interface IngestionOptions {
  skipDedup?: boolean;
  preferredTier?: ConnectorTier;
  timeoutMs?: number;
}

// API response
export interface IngestionApiResponse {
  success: boolean;
  message: string;
  data?: {
    processed: number;
    rejected: number;
    deduplicated: number;
    connectorUsed: string;
    tier: ConnectorTier | "unknown";
  };
  error?: string;
}
