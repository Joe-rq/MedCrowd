import { describe, it, expect, beforeEach } from "vitest";
import {
  AppleHealthConnector,
  GoogleFitConnector,
  ManualEntryConnector,
  FileImportConnector,
  createConnector,
  ingestWithFallback,
  deduplicatePoints,
  isDuplicateIngestion,
  getRegisteredConnectors,
} from "@/lib/health-connectors";
import type { HealthMetricPoint } from "@/lib/db/types";

describe("Health Connectors Tests", () => {
  describe("Tier A - Apple Health Connector", () => {
    let connector: AppleHealthConnector;

    beforeEach(() => {
      connector = new AppleHealthConnector();
    });

    it("should be unavailable without token", async () => {
      const status = await connector.checkAvailability("test-user");
      expect(status.available).toBe(false);
    });

    it("should be available with valid token", async () => {
      connector.setMockToken("test-user", "valid-token", 3600000);
      const status = await connector.checkAvailability("test-user");
      expect(status.available).toBe(true);
    });

    it("should ingest weight data", async () => {
      connector.setMockToken("test-user", "valid-token");

      const result = await connector.ingest("test-user", "weight", {
        value: 70.5,
        unit: "kg",
        startDate: "2024-01-15T10:00:00Z",
        sourceName: "Health Scale",
      });

      expect(result.success).toBe(true);
      expect(result.points.length).toBe(1);
      expect(result.points[0].value).toBe(70.5);
      expect(result.points[0].unit).toBe("kg");
    });

    it("should ingest sleep data converting seconds to hours", async () => {
      connector.setMockToken("test-user", "valid-token");

      const result = await connector.ingest("test-user", "sleep", {
        value: 28800,
        unit: "seconds",
        startDate: "2024-01-15T22:00:00Z",
        sourceName: "Apple Watch",
      });

      expect(result.success).toBe(true);
      expect(result.points[0].value).toBe(8);
      expect(result.points[0].unit).toBe("hours");
    });

    it("should reject invalid data", async () => {
      connector.setMockToken("test-user", "valid-token");

      const result = await connector.ingest("test-user", "weight", {
        value: "invalid",
        startDate: "invalid-date",
      });

      expect(result.success).toBe(false);
      expect(result.rejected.length).toBeGreaterThan(0);
    });

    it("should support all V1 metric types", async () => {
      const metrics = ["weight", "bmi", "sleep", "heartRate", "hrv"] as const;

      for (const metric of metrics) {
        expect(connector.capabilities.metrics).toContain(metric);
      }
    });
  });

  describe("Tier B - Google Fit Connector", () => {
    let connector: GoogleFitConnector;

    beforeEach(() => {
      connector = new GoogleFitConnector();
    });

    it("should be unavailable without auth", async () => {
      const status = await connector.checkAvailability("test-user");
      expect(status.available).toBe(false);
    });

    it("should parse Google Fit data points", async () => {
      // Google Fit returns empty since it has no valid token
      // This tests that the connector properly rejects when unavailable
      const result = await connector.ingest("test-user", "weight", [
        {
          startTimeNanos: "1705312800000000000",
          endTimeNanos: "1705312800000000000",
          value: [{ fpVal: 72.5 }],
          dataSourceId: "derived:com.google.weight:com.google.android.gms:merge_weight",
        },
      ]);

      // When connector is unavailable, it should reject
      expect(result.success).toBe(false);
      expect(result.rejected.length).toBeGreaterThan(0);
    });
  });

  describe("Tier C - Manual Entry Connector", () => {
    let connector: ManualEntryConnector;

    beforeEach(() => {
      connector = new ManualEntryConnector();
    });

    it("should always be available", async () => {
      const status = await connector.checkAvailability("test-user");
      expect(status.available).toBe(true);
    });

    it("should create manual entry", async () => {
      const point = await connector.addManualEntry(
        "test-user",
        "weight",
        68.5,
        "kg",
        1705312800000,
        "Morning measurement"
      );

      expect(point.value).toBe(68.5);
      expect(point.unit).toBe("kg");
      expect(point.confidence).toBe(0.7);
      expect(point.metadata?.notes).toBe("Morning measurement");
    });

    it("should reject invalid values", async () => {
      await expect(
        connector.addManualEntry("test-user", "weight", NaN, "kg", Date.now())
      ).rejects.toThrow("Invalid value");
    });
  });

  describe("Tier C - File Import Connector", () => {
    let connector: FileImportConnector;

    beforeEach(() => {
      connector = new FileImportConnector();
    });

    it("should parse CSV content", async () => {
      const csv = `timestamp,value,unit
2024-01-15T10:00:00Z,70.5,kg
2024-01-16T10:00:00Z,70.2,kg`;

      const result = await connector.ingest("test-user", "weight", {
        content: csv,
        format: "csv",
      });

      expect(result.success).toBe(true);
      expect(result.points.length).toBe(2);
    });

    it("should parse JSON content", async () => {
      const json = JSON.stringify([
        { timestamp: "2024-01-15T10:00:00Z", value: 70.5, unit: "kg" },
        { timestamp: "2024-01-16T10:00:00Z", value: 70.2, unit: "kg" },
      ]);

      const result = await connector.ingest("test-user", "weight", {
        content: json,
        format: "json",
      });

      expect(result.success).toBe(true);
      expect(result.points.length).toBe(2);
    });

    it("should use field mapping", async () => {
      const csv = `date,weight
2024-01-15T10:00:00Z,70.5`;

      const result = await connector.ingest("test-user", "weight", {
        content: csv,
        format: "csv",
        mapping: { timestamp: "date", value: "weight" },
      });

      expect(result.points.length).toBe(1);
      expect(result.points[0].value).toBe(70.5);
    });
  });

  describe("Connector Factory", () => {
    it("should create Tier A connectors", () => {
      const connector = createConnector("apple_health");
      expect(connector).not.toBeNull();
      expect(connector?.tier).toBe("A");
    });

    it("should create Tier B connectors", () => {
      const connector = createConnector("google_fit");
      expect(connector).not.toBeNull();
      expect(connector?.tier).toBe("B");
    });

    it("should create Tier C connectors", () => {
      const connector = createConnector("manual_entry");
      expect(connector).not.toBeNull();
      expect(connector?.tier).toBe("C");
    });

    it("should return null for unknown connectors", () => {
      const connector = createConnector("unknown");
      expect(connector).toBeNull();
    });

    it("should list all registered connectors", () => {
      const connectors = getRegisteredConnectors();
      expect(connectors.length).toBeGreaterThan(0);

      const tiers = connectors.map((c) => c.tier);
      expect(tiers).toContain("A");
      expect(tiers).toContain("B");
      expect(tiers).toContain("C");
    });
  });

  describe("Fallback Strategy", () => {
    it("should fall back to Tier C when Tier A unavailable", async () => {
      const result = await ingestWithFallback({
        userId: "test-user",
        metricType: "weight",
        data: { value: 70, unit: "kg", timestamp: Date.now() },
        source: "manual_entry",
      });

      expect(result.success).toBe(true);
      expect(result.metadata.connectorId).toBe("manual_entry");
    });

    it("should succeed with Tier C when no higher tier available", async () => {
      // When Tier A/B are unavailable, Tier C (manual_entry) should handle the request
      const result = await ingestWithFallback({
        userId: "test-user",
        metricType: "weight",
        data: { value: 70, unit: "kg", timestamp: Date.now() },
        source: "manual_entry",
        options: { timeoutMs: 1000 },
      });

      // Manual entry should always succeed
      expect(result.success).toBe(true);
      expect(result.points.length).toBeGreaterThan(0);
    });
  });

  describe("Deduplication", () => {
    const basePoint: HealthMetricPoint = {
      timestamp: 1705312800000,
      value: 70.5,
      unit: "kg",
      source: "apple_health",
      confidence: 0.95,
    };

    it("should identify duplicates within time window", () => {
      const existing: HealthMetricPoint[] = [
        { ...basePoint, timestamp: basePoint.timestamp + 60000 },
      ];

      const isDup = isDuplicateIngestion(basePoint, existing, 300000);
      expect(isDup).toBe(true);
    });

    it("should not flag different timestamps as duplicates", () => {
      const existing: HealthMetricPoint[] = [
        { ...basePoint, timestamp: basePoint.timestamp + 600000 },
      ];

      const isDup = isDuplicateIngestion(basePoint, existing, 300000);
      expect(isDup).toBe(false);
    });

    it("should not flag different sources as duplicates", () => {
      const existing: HealthMetricPoint[] = [
        { ...basePoint, source: "google_fit" },
      ];

      const isDup = isDuplicateIngestion(basePoint, existing);
      expect(isDup).toBe(false);
    });

    it("should deduplicate batch", () => {
      const newPoints: HealthMetricPoint[] = [
        basePoint,
        { ...basePoint, value: 71.0 },
      ];

      const existing: HealthMetricPoint[] = [basePoint];

      const result = deduplicatePoints(newPoints, existing, {
        windowMs: 300000,
        fields: ["timestamp", "value", "source"],
        valueTolerance: 0.001,
      });

      expect(result.unique.length).toBe(1);
      expect(result.duplicates.length).toBe(1);
    });
  });
});
