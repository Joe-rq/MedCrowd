// Health Connectors Factory - Tier A/B/C fallback strategy

import type {
  HealthConnector,
  ConnectorTier,
  IngestionRequest,
  IngestionResult,
  IngestionOptions,
  DeduplicationConfig,
} from "./types";
import { createTierAConnector, TIER_A_CONNECTORS } from "./tier-a";
import { createTierBConnector, TIER_B_CONNECTORS } from "./tier-b";
import { createTierCConnector, TIER_C_CONNECTORS } from "./tier-c";
import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

// Connector registry with priority ordering
const CONNECTOR_REGISTRY = [
  ...TIER_A_CONNECTORS.map((c) => ({ ...c, tier: "A" as ConnectorTier, priority: 1 })),
  ...TIER_B_CONNECTORS.map((c) => ({ ...c, tier: "B" as ConnectorTier, priority: 2 })),
  ...TIER_C_CONNECTORS.map((c) => ({ ...c, tier: "C" as ConnectorTier, priority: 3 })),
];

export function getRegisteredConnectors() {
  return CONNECTOR_REGISTRY;
}

export function createConnector(id: string): HealthConnector | null {
  return (
    createTierAConnector(id) ||
    createTierBConnector(id) ||
    createTierCConnector(id)
  );
}

// Fallback ingestion with tier A → B → C strategy
export async function ingestWithFallback(
  request: IngestionRequest
): Promise<IngestionResult> {
  const { userId, metricType, data, source, options } = request;
  const preferredTier = options?.preferredTier;
  const timeoutMs = options?.timeoutMs || 30000;

  const tiersToTry = getTierOrder(preferredTier);
  const errors: string[] = [];

  for (const tier of tiersToTry) {
    const connectors = getConnectorsForTier(tier, source);

    for (const connector of connectors) {
      try {
        const status = await withTimeout(
          connector.checkAvailability(userId),
          timeoutMs
        );

        if (!status.available) {
          errors.push(`${connector.id}: ${status.error || "Unavailable"}`);
          continue;
        }

        const result = await withTimeout(
          connector.ingest(userId, metricType, data),
          timeoutMs
        );

        if (result.success && result.points.length > 0) {
          return {
            ...result,
            metadata: {
              ...result.metadata,
              connectorId: connector.id,
            },
          };
        }

        if (result.rejected.length > 0) {
          errors.push(`${connector.id}: ${result.rejected[0].reason}`);
        }
      } catch (error) {
        errors.push(`${connector.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  return {
    success: false,
    points: [],
    rejected: [{
      reason: `All connectors failed: ${errors.join("; ")}`,
      rawData: data,
      timestamp: Date.now(),
    }],
    metadata: {
      source: source || "unknown",
      connectorId: "none",
      processedAt: Date.now(),
      latencyMs: 0,
      deduplicatedCount: 0,
    },
  };
}

// Batch ingestion with deduplication
export async function ingestBatch(
  userId: string,
  items: Array<{ metricType: HealthMetricType; data: unknown; source: string }>,
  options?: IngestionOptions
): Promise<{
  success: number;
  failed: number;
  deduplicated: number;
  results: IngestionResult[];
}> {
  const results: IngestionResult[] = [];
  let success = 0;
  let failed = 0;

  for (const item of items) {
    const result = await ingestWithFallback({
      userId,
      metricType: item.metricType,
      data: item.data,
      source: item.source,
      options,
    });

    results.push(result);

    if (result.success) {
      success += result.points.length;
    } else {
      failed += 1;
    }
  }

  return {
    success,
    failed,
    deduplicated: results.reduce((sum, r) => sum + r.metadata.deduplicatedCount, 0),
    results,
  };
}

// Deduplication helper using validator patterns
export function deduplicatePoints(
  newPoints: HealthMetricPoint[],
  existingPoints: HealthMetricPoint[],
  config: DeduplicationConfig = { windowMs: 300000, fields: ["timestamp", "value", "source"], valueTolerance: 0.001 }
): { unique: HealthMetricPoint[]; duplicates: HealthMetricPoint[] } {
  const unique: HealthMetricPoint[] = [];
  const duplicates: HealthMetricPoint[] = [];

  for (const newPoint of newPoints) {
    const isDup = existingPoints.some((existing) =>
      isDuplicate(newPoint, existing, config)
    );

    if (isDup) {
      duplicates.push(newPoint);
    } else {
      unique.push(newPoint);
    }
  }

  return { unique, duplicates };
}

// Check if two points are duplicates
function isDuplicate(
  a: HealthMetricPoint,
  b: HealthMetricPoint,
  config: DeduplicationConfig
): boolean {
  // Check timestamp window
  if (config.fields.includes("timestamp")) {
    const timeDiff = Math.abs(a.timestamp - b.timestamp);
    if (timeDiff > config.windowMs) return false;
  }

  // Check source
  if (config.fields.includes("source") && a.source !== b.source) {
    return false;
  }

  // Check value with tolerance
  if (config.fields.includes("value")) {
    const valueDiff = Math.abs(a.value - b.value);
    if (valueDiff > config.valueTolerance) return false;
  }

  return true;
}

// Check for duplicate within same source/timestamp window
export function isDuplicateIngestion(
  newPoint: HealthMetricPoint,
  existingPoints: HealthMetricPoint[],
  windowMs: number = 300000
): boolean {
  return existingPoints.some((existing) => {
    const sameSource = newPoint.source === existing.source;
    const timeInWindow = Math.abs(newPoint.timestamp - existing.timestamp) <= windowMs;
    const sameValue = Math.abs(newPoint.value - existing.value) < 0.001;

    return sameSource && timeInWindow && sameValue;
  });
}

// Helper functions
function getTierOrder(preferredTier?: ConnectorTier): ConnectorTier[] {
  const allTiers: ConnectorTier[] = ["A", "B", "C"];

  if (!preferredTier) return allTiers;

  const ordered: ConnectorTier[] = [preferredTier];
  for (const tier of allTiers) {
    if (!ordered.includes(tier)) ordered.push(tier);
  }

  return ordered;
}

function getConnectorsForTier(tier: ConnectorTier, preferredSource?: string): HealthConnector[] {
  const connectors: HealthConnector[] = [];

  const tierConnectors = CONNECTOR_REGISTRY.filter((c) => c.tier === tier);

  for (const conn of tierConnectors) {
    const connector = createConnector(conn.id);
    if (connector) connectors.push(connector);
  }

  // Sort by priority, preferred source first if specified
  if (preferredSource) {
    connectors.sort((a, b) => {
      const aMatch = a.id === preferredSource ? -1 : 0;
      const bMatch = b.id === preferredSource ? -1 : 0;
      return aMatch - bMatch;
    });
  }

  return connectors;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]);
}

// Export all connector types
export * from "./types";
export { AppleHealthConnector, createTierAConnector, TIER_A_CONNECTORS } from "./tier-a";
export { GoogleFitConnector, WithingsConnector, createTierBConnector, TIER_B_CONNECTORS } from "./tier-b";
export { ManualEntryConnector, FileImportConnector, createTierCConnector, TIER_C_CONNECTORS } from "./tier-c";
