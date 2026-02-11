// Tier A Connectors - Direct platform integrations (Apple HealthKit pattern)

import type {
  HealthConnector,
  ConnectorStatus,
  IngestionResult,
  RejectedMetric,
  IngestionMetadata,
} from "./types";
import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

// Apple HealthKit connector implementation
export class AppleHealthConnector implements HealthConnector {
  readonly id = "apple_health";
  readonly name = "Apple Health";
  readonly tier = "A" as const;

  readonly capabilities = {
    metrics: ["weight", "bmi", "sleep", "heartRate", "hrv"] as HealthMetricType[],
    features: ["batch_upload", "historical_sync", "automatic_sync"] as const,
  };

  private userTokens = new Map<string, { token: string; expiry: number }>();

  async checkAvailability(userId: string): Promise<ConnectorStatus> {
    const start = performance.now();

    try {
      // Check if user has authorized Apple Health
      const token = this.userTokens.get(userId);
      if (!token) {
        return {
          available: false,
          lastChecked: Date.now(),
          error: "Apple Health not authorized for this user",
        };
      }

      // Check token expiry
      if (token.expiry < Date.now()) {
        return {
          available: false,
          lastChecked: Date.now(),
          error: "Apple Health token expired",
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
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  async validateAccessToken(userId: string): Promise<boolean> {
    const token = this.userTokens.get(userId);
    if (!token) return false;
    return token.expiry > Date.now();
  }

  async ingest(
    userId: string,
    metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult> {
    const start = performance.now();
    const points: HealthMetricPoint[] = [];
    const rejected: RejectedMetric[] = [];
    const deduplicatedCount = 0;

    try {
      // Check availability first
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
          metadata: this.createMetadata(start, 0, userId),
        };
      }

      // Parse Apple Health data format
      const data = rawData as AppleHealthData | AppleHealthData[];
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const point = this.parseHealthKitItem(item, metricType);
        if (point) {
          points.push(point);
        } else {
          rejected.push({
            reason: `Failed to parse ${metricType} data`,
            rawData: item,
            timestamp: Date.now(),
          });
        }
      }

      return {
        success: points.length > 0,
        points,
        rejected,
        metadata: this.createMetadata(start, deduplicatedCount, userId),
      };
    } catch (error) {
      return {
        success: false,
        points,
        rejected: [
          ...rejected,
          {
            reason: error instanceof Error ? error.message : "Ingestion failed",
            rawData,
            timestamp: Date.now(),
          },
        ],
        metadata: this.createMetadata(start, deduplicatedCount, userId),
      };
    }
  }

  private parseHealthKitItem(
    item: AppleHealthData,
    metricType: HealthMetricType
  ): HealthMetricPoint | null {
    try {
      const dateValue = item.startDate || item.date;
      if (!dateValue) return null;
      const timestamp = new Date(dateValue).getTime();
      if (isNaN(timestamp)) return null;

      const { value, unit } = this.extractValueAndUnit(item, metricType);
      if (value === null || isNaN(value)) return null;

      return {
        timestamp,
        value,
        unit,
        source: item.sourceName || this.id,
        confidence: this.calculateConfidence(item),
        metadata: {
          sourceVersion: item.sourceVersion,
          device: item.device,
          ...(item.metadata || {}),
        },
      };
    } catch {
      return null;
    }
  }

  private extractValueAndUnit(
    item: AppleHealthData,
    metricType: HealthMetricType
  ): { value: number | null; unit: string } {
    switch (metricType) {
      case "weight":
        return {
          value: this.parseNumeric(item.value),
          unit: item.unit || "kg",
        };
      case "bmi":
        return {
          value: this.parseNumeric(item.value),
          unit: "kg/m2",
        };
      case "sleep": {
        const sleepValue = this.parseNumeric(item.value);
        if (item.unit?.toLowerCase().includes("second")) {
          return { value: sleepValue ? sleepValue / 3600 : null, unit: "hours" };
        }
        return { value: sleepValue, unit: item.unit || "hours" };
      }
      case "heartRate":
        return {
          value: this.parseNumeric(item.value),
          unit: item.unit || "bpm",
        };
      case "hrv":
        return {
          value: this.parseNumeric(item.value),
          unit: item.unit || "ms",
        };
      default:
        return { value: null, unit: "" };
    }
  }

  private parseNumeric(value: unknown): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private calculateConfidence(item: AppleHealthData): number {
    // Higher confidence for device-recorded data
    if (item.device && item.sourceName) {
      return 0.95;
    }
    if (item.sourceName) {
      return 0.85;
    }
    return 0.75;
  }

  private createMetadata(
    startTime: number,
    deduplicatedCount: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string
  ): IngestionMetadata {
    return {
      source: this.id,
      connectorId: this.id,
      processedAt: Date.now(),
      latencyMs: Math.round(performance.now() - startTime),
      deduplicatedCount,
    };
  }

  // Mock methods for token management (to be implemented with real OAuth)
  setMockToken(userId: string, token: string, expiryMs: number = 3600000): void {
    this.userTokens.set(userId, {
      token,
      expiry: Date.now() + expiryMs,
    });
  }

  clearToken(userId: string): void {
    this.userTokens.delete(userId);
  }
}

// Apple HealthKit data format (simplified)
interface AppleHealthData {
  value: string | number;
  unit?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  sourceName?: string;
  sourceVersion?: string;
  device?: string;
  metadata?: Record<string, unknown>;
}

// Factory function for creating Tier A connectors
export function createTierAConnector(id: string): AppleHealthConnector | null {
  switch (id) {
    case "apple_health":
      return new AppleHealthConnector();
    default:
      return null;
  }
}

// List available Tier A connectors
export const TIER_A_CONNECTORS = [
  {
    id: "apple_health",
    name: "Apple Health",
    description: "Direct integration with Apple HealthKit",
  },
];
