// Tier B Connectors - Aggregator APIs (Google Fit, Withings patterns)

import type {
  HealthConnector,
  ConnectorStatus,
  IngestionResult,
  RejectedMetric,
  IngestionMetadata,
} from "./types";
import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

// Google Fit connector implementation
export class GoogleFitConnector implements HealthConnector {
  readonly id = "google_fit";
  readonly name = "Google Fit";
  readonly tier = "B" as const;

  readonly capabilities = {
    metrics: ["weight", "bmi", "sleep", "heartRate", "hrv"] as HealthMetricType[],
    features: ["batch_upload", "historical_sync", "automatic_sync"] as const,
  };

  private apiBaseUrl = "https://www.googleapis.com/fitness/v1/users/me";

  async checkAvailability(userId: string): Promise<ConnectorStatus> {
    const start = performance.now();

    try {
      const hasToken = await this.hasValidToken(userId);
      if (!hasToken) {
        return {
          available: false,
          lastChecked: Date.now(),
          error: "Google Fit not connected",
        };
      }

      return {
        available: true,
        lastChecked: Date.now(),
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      return {
        available: false,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async ingest(
    userId: string,
    metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult> {
    const start = performance.now();

    const status = await this.checkAvailability(userId);
    if (!status.available) {
      return {
        success: false,
        points: [],
        rejected: [{
          reason: status.error || "Connector unavailable",
          rawData,
          timestamp: Date.now(),
        }],
        metadata: this.createMetadata(start, 0),
      };
    }

    const data = rawData as GoogleFitDataPoint[];
    const points: HealthMetricPoint[] = [];
    const rejected: RejectedMetric[] = [];

    for (const item of Array.isArray(data) ? data : [data]) {
      const point = this.parseGoogleFitPoint(item, metricType);
      if (point) {
        points.push(point);
      } else {
        rejected.push({
          reason: `Failed to parse ${metricType} from Google Fit`,
          rawData: item,
          timestamp: Date.now(),
        });
      }
    }

    return {
      success: points.length > 0,
      points,
      rejected,
      metadata: this.createMetadata(start, 0),
    };
  }

  async syncSince(userId: string, since: number): Promise<IngestionResult> {
    const start = performance.now();

    const status = await this.checkAvailability(userId);
    if (!status.available) {
      return {
        success: false,
        points: [],
        rejected: [{
          reason: status.error || "Cannot sync - connector unavailable",
          rawData: { since },
          timestamp: Date.now(),
        }],
        metadata: this.createMetadata(start, 0),
      };
    }

    return {
      success: true,
      points: [],
      rejected: [],
      metadata: this.createMetadata(start, 0),
    };
  }

  private parseGoogleFitPoint(
    point: GoogleFitDataPoint,
    metricType: HealthMetricType
  ): HealthMetricPoint | null {
    try {
      const startTime = parseInt(point.startTimeNanos, 10) / 1e6;
      const value = this.extractValue(point.value?.[0], metricType);

      if (value === null || isNaN(value)) return null;

      return {
        timestamp: startTime,
        value,
        unit: this.getUnit(metricType),
        source: point.dataSourceId || this.id,
        confidence: 0.85,
        metadata: {
          endTime: point.endTimeNanos,
          dataSourceId: point.dataSourceId,
        },
      };
    } catch {
      return null;
    }
  }

  private extractValue(val: GoogleFitValue | undefined, metricType: HealthMetricType): number | null {
    if (!val) return null;

    switch (metricType) {
      case "weight":
        return val.fpVal ?? null;
      case "bmi":
        return val.fpVal ?? null;
      case "heartRate":
        return val.fpVal ?? null;
      case "sleep":
        return val.intVal ? val.intVal / 3600 : null;
      case "hrv":
        return val.fpVal ?? null;
      default:
        return null;
    }
  }

  private getUnit(metricType: HealthMetricType): string {
    const units: Record<HealthMetricType, string> = {
      weight: "kg",
      bmi: "kg/m2",
      sleep: "hours",
      heartRate: "bpm",
      hrv: "ms",
    };
    return units[metricType];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async hasValidToken(_userId: string): Promise<boolean> {
    return false;
  }

  private createMetadata(startTime: number, dedupCount: number): IngestionMetadata {
    return {
      source: this.id,
      connectorId: this.id,
      processedAt: Date.now(),
      latencyMs: Math.round(performance.now() - startTime),
      deduplicatedCount: dedupCount,
    };
  }
}

// Withings connector implementation
export class WithingsConnector implements HealthConnector {
  readonly id = "withings";
  readonly name = "Withings";
  readonly tier = "B" as const;

  readonly capabilities = {
    metrics: ["weight", "bmi", "heartRate"] as HealthMetricType[],
    features: ["batch_upload", "historical_sync", "automatic_sync"] as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkAvailability(_userId: string): Promise<ConnectorStatus> {
    return {
      available: false,
      lastChecked: Date.now(),
      error: "Withings integration not yet implemented",
    };
  }

  async ingest(
    _userId: string,
    _metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult> {
    return {
      success: false,
      points: [],
      rejected: [{
        reason: "Withings connector not implemented",
        rawData,
        timestamp: Date.now(),
      }],
      metadata: {
        source: this.id,
        connectorId: this.id,
        processedAt: Date.now(),
        latencyMs: 0,
        deduplicatedCount: 0,
      },
    };
  }

  async syncSince(userId: string, since: number): Promise<IngestionResult> {
    return this.ingest(userId, "weight", { since });
  }
}

// Google Fit API types
interface GoogleFitDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataSourceId?: string;
  value?: GoogleFitValue[];
}

interface GoogleFitValue {
  intVal?: number;
  fpVal?: number;
  stringVal?: string;
}

export function createTierBConnector(id: string): GoogleFitConnector | WithingsConnector | null {
  switch (id) {
    case "google_fit":
      return new GoogleFitConnector();
    case "withings":
      return new WithingsConnector();
    default:
      return null;
  }
}

export const TIER_B_CONNECTORS = [
  { id: "google_fit", name: "Google Fit", description: "Google Fit API integration" },
  { id: "withings", name: "Withings", description: "Withings Health Mate integration" },
];
