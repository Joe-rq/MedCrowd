// Tier C Connectors - Manual entry and file import fallback

import type {
  HealthConnector,
  ConnectorStatus,
  IngestionResult,
  IngestionMetadata,
  FieldMapping,
} from "./types";
import type { HealthMetricType, HealthMetricPoint } from "@/lib/db/types";

// Manual entry connector - always available fallback
export class ManualEntryConnector implements HealthConnector {
  readonly id = "manual_entry";
  readonly name = "Manual Entry";
  readonly tier = "C" as const;

  readonly capabilities = {
    metrics: ["weight", "bmi", "sleep", "heartRate", "hrv"] as HealthMetricType[],
    features: ["manual_entry"] as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkAvailability(_userId: string): Promise<ConnectorStatus> {
    return {
      available: true,
      lastChecked: Date.now(),
    };
  }

  async ingest(
    userId: string,
    metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult> {
    const start = performance.now();

    try {
      const data = rawData as ManualEntryData;
      const point = await this.addManualEntry(
        userId,
        metricType,
        data.value,
        data.unit || this.getDefaultUnit(metricType),
        data.timestamp || Date.now(),
        data.notes
      );

      return {
        success: true,
        points: [point],
        rejected: [],
        metadata: this.createMetadata(start, 0),
      };
    } catch (error) {
      return {
        success: false,
        points: [],
        rejected: [{
          reason: error instanceof Error ? error.message : "Manual entry failed",
          rawData,
          timestamp: Date.now(),
        }],
        metadata: this.createMetadata(start, 0),
      };
    }
  }

  async addManualEntry(
    userId: string,
    metricType: HealthMetricType,
    value: number,
    unit: string,
    timestamp: number,
    notes?: string
  ): Promise<HealthMetricPoint> {
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error("Invalid value: must be a number");
    }

    return {
      timestamp,
      value,
      unit,
      source: this.id,
      confidence: 0.7,
      metadata: notes ? { notes, enteredBy: userId } : { enteredBy: userId },
    };
  }

  private getDefaultUnit(metricType: HealthMetricType): string {
    const units: Record<HealthMetricType, string> = {
      weight: "kg",
      bmi: "kg/m2",
      sleep: "hours",
      heartRate: "bpm",
      hrv: "ms",
    };
    return units[metricType];
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

// File import connector - CSV/JSON import fallback
export class FileImportConnector implements HealthConnector {
  readonly id = "file_import";
  readonly name = "File Import";
  readonly tier = "C" as const;

  readonly capabilities = {
    metrics: ["weight", "bmi", "sleep", "heartRate", "hrv"] as HealthMetricType[],
    features: ["manual_entry"] as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkAvailability(_userId: string): Promise<ConnectorStatus> {
    return {
      available: true,
      lastChecked: Date.now(),
    };
  }

  async ingest(
    userId: string,
    metricType: HealthMetricType,
    rawData: unknown
  ): Promise<IngestionResult> {
    const start = performance.now();

    try {
      const data = rawData as FileImportData;
      if (!data.content || !data.format) {
        throw new Error("Invalid file import data: missing content or format");
      }

      const points = this.parseFileContent(
        data.content,
        data.format,
        metricType,
        data.mapping
      );

      return {
        success: points.length > 0,
        points,
        rejected: [],
        metadata: this.createMetadata(start, 0),
      };
    } catch (error) {
      return {
        success: false,
        points: [],
        rejected: [{
          reason: error instanceof Error ? error.message : "File import failed",
          rawData,
          timestamp: Date.now(),
        }],
        metadata: this.createMetadata(start, 0),
      };
    }
  }

  private parseFileContent(
    content: string,
    format: "csv" | "json",
    metricType: HealthMetricType,
    mapping?: FieldMapping
  ): HealthMetricPoint[] {
    if (format === "json") {
      return this.parseJsonContent(content, metricType, mapping);
    }
    return this.parseCsvContent(content, metricType, mapping);
  }

  private parseJsonContent(
    content: string,
    metricType: HealthMetricType,
    mapping?: FieldMapping
  ): HealthMetricPoint[] {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : [data];
    const points: HealthMetricPoint[] = [];

    for (const item of items) {
      const point = this.parseItem(item, metricType, mapping);
      if (point) points.push(point);
    }

    return points;
  }

  private parseCsvContent(
    content: string,
    metricType: HealthMetricType,
    mapping?: FieldMapping
  ): HealthMetricPoint[] {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const points: HealthMetricPoint[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const item: Record<string, string> = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx];
      });

      const point = this.parseItem(item, metricType, mapping);
      if (point) points.push(point);
    }

    return points;
  }

  private parseItem(
    item: Record<string, unknown>,
    metricType: HealthMetricType,
    mapping?: FieldMapping
  ): HealthMetricPoint | null {
    try {
      const valueField = mapping?.value || "value";
      const timeField = mapping?.timestamp || "timestamp" || "date";
      const unitField = mapping?.unit || "unit";

      const rawValue = item[valueField];
      const value = typeof rawValue === "string" ? parseFloat(rawValue) : Number(rawValue);

      if (isNaN(value)) return null;

      const rawTime = item[timeField];
      const timestamp = typeof rawTime === "string"
        ? new Date(rawTime).getTime()
        : Number(rawTime);

      if (isNaN(timestamp)) return null;

      return {
        timestamp,
        value,
        unit: (item[unitField] as string) || this.getDefaultUnit(metricType),
        source: this.id,
        confidence: 0.65,
        metadata: { importMethod: "file" },
      };
    } catch {
      return null;
    }
  }

  private getDefaultUnit(metricType: HealthMetricType): string {
    const units: Record<HealthMetricType, string> = {
      weight: "kg",
      bmi: "kg/m2",
      sleep: "hours",
      heartRate: "bpm",
      hrv: "ms",
    };
    return units[metricType];
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

interface ManualEntryData {
  value: number;
  unit?: string;
  timestamp?: number;
  notes?: string;
}

interface FileImportData {
  content: string;
  format: "csv" | "json";
  mapping?: FieldMapping;
}

export function createTierCConnector(id: string): ManualEntryConnector | FileImportConnector | null {
  switch (id) {
    case "manual_entry":
      return new ManualEntryConnector();
    case "file_import":
      return new FileImportConnector();
    default:
      return null;
  }
}

export const TIER_C_CONNECTORS = [
  { id: "manual_entry", name: "Manual Entry", description: "Manual data entry fallback" },
  { id: "file_import", name: "File Import", description: "CSV/JSON file import" },
];
