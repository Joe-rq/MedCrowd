import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  addHealthMetric,
  addHealthMetricsBatch,
  getHealthMetrics,
  getHealthMetricsForWindow,
  saveWeeklyHealthSnapshot,
  getWeeklyHealthSnapshots,
  aggregateHealthToWeekly,
  getUserHealthMetricTypes,
  deleteUserHealthMetrics,
  checkHealthMetricsMigrationTriggers,
  resetJSONCache,
  getWeekId,
  type HealthMetricPoint,
  type WeeklySnapshot,
} from "@/lib/db";

const TEST_DB_FILE = path.join(process.cwd(), "data", "medcrowd.db.json");

describe("Health Metrics CRUD Tests", () => {
  const testUserId = "test-user-health-metrics";

  beforeEach(() => {
    process.env.KV_REST_API_URL = "";
    process.env.DB_MODE = "json";
    resetJSONCache();
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  function createMetricPoint(overrides: Partial<HealthMetricPoint> = {}): HealthMetricPoint {
    return {
      timestamp: Date.now(),
      value: 70.5,
      unit: "kg",
      source: "apple_health",
      confidence: 0.95,
      ...overrides,
    };
  }

  describe("addHealthMetric", () => {
    it("should add a single raw metric point", async () => {
      const point = createMetricPoint({
        timestamp: Date.now(),
        value: 72.5,
        unit: "kg",
        source: "manual_entry",
      });

      await addHealthMetric(testUserId, "weight", point);

      const metrics = await getHealthMetrics(
        testUserId,
        "weight",
        point.timestamp - 1000,
        point.timestamp + 1000
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(72.5);
      expect(metrics[0].unit).toBe("kg");
      expect(metrics[0].source).toBe("manual_entry");
    });

    it("should support all V1 metric types", async () => {
      const metricTypes = ["weight", "bmi", "sleep", "heartRate", "hrv"] as const;

      for (const metricType of metricTypes) {
        const point = createMetricPoint({
          value: metricType === "sleep" ? 7.5 : 70,
          unit: metricType === "sleep" ? "hours" : "kg",
        });

        await addHealthMetric(testUserId, metricType, point);
      }

      const userMetricTypes = await getUserHealthMetricTypes(testUserId);
      expect(userMetricTypes.length).toBe(5);
      expect(userMetricTypes).toContain("weight");
      expect(userMetricTypes).toContain("bmi");
      expect(userMetricTypes).toContain("sleep");
      expect(userMetricTypes).toContain("heartRate");
      expect(userMetricTypes).toContain("hrv");
    });

    it("should store multiple points per day and sort by timestamp", async () => {
      const baseTime = new Date("2024-01-15T12:00:00Z").getTime();

      await addHealthMetric(testUserId, "weight", createMetricPoint({
        timestamp: baseTime + 3600000,
        value: 71.0,
      }));
      await addHealthMetric(testUserId, "weight", createMetricPoint({
        timestamp: baseTime,
        value: 70.0,
      }));
      await addHealthMetric(testUserId, "weight", createMetricPoint({
        timestamp: baseTime + 7200000,
        value: 72.0,
      }));

      const metrics = await getHealthMetrics(testUserId, "weight", baseTime, baseTime + 7200000);

      expect(metrics.length).toBe(3);
      expect(metrics[0].value).toBe(70.0);
      expect(metrics[1].value).toBe(71.0);
      expect(metrics[2].value).toBe(72.0);
    });
  });

  describe("addHealthMetricsBatch", () => {
    it("should batch add multiple metric points", async () => {
      const baseTime = new Date("2024-01-15T00:00:00Z").getTime();
      const points: HealthMetricPoint[] = [
        createMetricPoint({ timestamp: baseTime, value: 70.0 }),
        createMetricPoint({ timestamp: baseTime + 86400000, value: 70.5 }),
        createMetricPoint({ timestamp: baseTime + 172800000, value: 71.0 }),
      ];

      const result = await addHealthMetricsBatch(testUserId, "weight", points);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);

      const metrics = await getHealthMetrics(testUserId, "weight", baseTime, baseTime + 172800000);
      expect(metrics.length).toBe(3);
    });

    it("should group points by date for efficient storage", async () => {
      const baseTime = new Date("2024-01-15T00:00:00Z").getTime();
      const points: HealthMetricPoint[] = [
        createMetricPoint({ timestamp: baseTime + 1000, value: 70.0 }),
        createMetricPoint({ timestamp: baseTime + 2000, value: 70.1 }),
        createMetricPoint({ timestamp: baseTime + 3000, value: 70.2 }),
      ];

      const result = await addHealthMetricsBatch(testUserId, "weight", points);

      expect(result.success).toBe(3);
    });
  });

  describe("getHealthMetrics", () => {
    it("should filter metrics by time range", async () => {
      const baseTime = new Date("2024-01-15T00:00:00Z").getTime();

      await addHealthMetric(testUserId, "heartRate", createMetricPoint({
        timestamp: baseTime,
        value: 60,
        unit: "bpm",
      }));
      await addHealthMetric(testUserId, "heartRate", createMetricPoint({
        timestamp: baseTime + 3600000,
        value: 65,
        unit: "bpm",
      }));
      await addHealthMetric(testUserId, "heartRate", createMetricPoint({
        timestamp: baseTime + 7200000,
        value: 70,
        unit: "bpm",
      }));

      const metrics = await getHealthMetrics(
        testUserId,
        "heartRate",
        baseTime + 1800000,
        baseTime + 5400000
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(65);
    });

    it("should return empty array when no metrics exist", async () => {
      const metrics = await getHealthMetrics(
        testUserId,
        "hrv",
        Date.now() - 86400000,
        Date.now()
      );

      expect(metrics).toEqual([]);
    });
  });

  describe("Weekly Snapshots", () => {
    it("should save and retrieve weekly snapshot", async () => {
      const snapshot: WeeklySnapshot = {
        weekId: "2024-W03",
        startDate: new Date("2024-01-15T00:00:00Z").getTime(),
        endDate: new Date("2024-01-21T23:59:59Z").getTime(),
        metricType: "weight",
        avg: 71.5,
        min: 70.0,
        max: 73.0,
        count: 7,
        unit: "kg",
        source: "apple_health",
        confidence: 0.92,
        rawDataPoints: 28,
      };

      await saveWeeklyHealthSnapshot(testUserId, "weight", snapshot);

      const snapshots = await getWeeklyHealthSnapshots(testUserId, "weight", "2024-W03", "2024-W03");

      expect(snapshots.length).toBe(1);
      expect(snapshots[0].weekId).toBe("2024-W03");
      expect(snapshots[0].avg).toBe(71.5);
    });

    it("should aggregate raw data to weekly snapshot", async () => {
      const weekStart = new Date("2024-01-15T00:00:00Z").getTime();

      for (let i = 0; i < 7; i++) {
        await addHealthMetric(testUserId, "sleep", createMetricPoint({
          timestamp: weekStart + i * 86400000,
          value: 6 + i * 0.5,
          unit: "hours",
          source: "fitbit",
        }));
      }

      const snapshot = await aggregateHealthToWeekly(testUserId, "sleep", "2024-W03");

      expect(snapshot).not.toBeNull();
      expect(snapshot!.count).toBe(7);
      expect(snapshot!.unit).toBe("hours");
      expect(snapshot!.source).toBe("fitbit");
      expect(snapshot!.avg).toBeGreaterThan(7);
    });
  });

  describe("getHealthMetricsForWindow", () => {
    it("should return raw data for recent window", async () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      await addHealthMetric(testUserId, "bmi", createMetricPoint({
        timestamp: oneDayAgo + 3600000,
        value: 22.5,
        unit: "kg/m2",
      }));

      const result = await getHealthMetricsForWindow(testUserId, "bmi", oneDayAgo, now);

      expect(result.raw.length).toBe(1);
      expect(result.weekly.length).toBe(0);
      expect(result.boundaryWeek).toBeUndefined();
    });

    it("should handle window spanning retention boundary", async () => {
      const now = Date.now();
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
      const tenDaysAgoWeekId = getWeekId(tenDaysAgo);

      const snapshot: WeeklySnapshot = {
        weekId: tenDaysAgoWeekId,
        startDate: tenDaysAgo,
        endDate: tenDaysAgo + 6 * 24 * 60 * 60 * 1000,
        metricType: "weight",
        avg: 70.0,
        min: 69.0,
        max: 71.0,
        count: 7,
        unit: "kg",
        source: "apple_health",
        confidence: 0.9,
        rawDataPoints: 7,
      };
      await saveWeeklyHealthSnapshot(testUserId, "weight", snapshot);

      const result = await getHealthMetricsForWindow(testUserId, "weight", tenDaysAgo, now);

      expect(result.weekly.length).toBeGreaterThan(0);
    });
  });

  describe("User Metrics Index", () => {
    it("should track user metric types", async () => {
      await addHealthMetric(testUserId, "weight", createMetricPoint({ value: 70 }));
      await addHealthMetric(testUserId, "sleep", createMetricPoint({
        value: 8,
        unit: "hours",
      }));

      const types = await getUserHealthMetricTypes(testUserId);

      expect(types).toContain("weight");
      expect(types).toContain("sleep");
      expect(types.length).toBe(2);
    });
  });

  describe("deleteUserHealthMetrics", () => {
    it("should delete user metrics index", async () => {
      await addHealthMetric(testUserId, "weight", createMetricPoint({ value: 70 }));

      let types = await getUserHealthMetricTypes(testUserId);
      expect(types.length).toBe(1);

      await deleteUserHealthMetrics(testUserId);

      types = await getUserHealthMetricTypes(testUserId);
      expect(types.length).toBe(0);
    });
  });

  describe("checkHealthMetricsMigrationTriggers", () => {
    it("should return migration trigger status", async () => {
      const result = await checkHealthMetricsMigrationTriggers();

      expect(result.shouldMigrate).toBe(false);
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.metrics.highLatencyOps).toBe(0);
      expect(result.metrics.totalOps).toBe(0);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve all metric point fields", async () => {
      const point: HealthMetricPoint = {
        timestamp: Date.now(),
        value: 65.5,
        unit: "kg",
        source: "withings_scale",
        confidence: 0.98,
        metadata: { deviceId: "scale-123", batteryLevel: 85 },
      };

      await addHealthMetric(testUserId, "weight", point);

      const metrics = await getHealthMetrics(
        testUserId,
        "weight",
        point.timestamp - 1000,
        point.timestamp + 1000
      );

      expect(metrics[0].timestamp).toBe(point.timestamp);
      expect(metrics[0].value).toBe(point.value);
      expect(metrics[0].unit).toBe(point.unit);
      expect(metrics[0].source).toBe(point.source);
      expect(metrics[0].confidence).toBe(point.confidence);
      expect(metrics[0].metadata).toEqual(point.metadata);
    });

    it("should calculate correct week boundaries", async () => {
      const jan15 = new Date("2024-01-15T12:00:00Z").getTime();

      await addHealthMetric(testUserId, "weight", createMetricPoint({
        timestamp: jan15,
        value: 70,
      }));

      const snapshot = await aggregateHealthToWeekly(testUserId, "weight", "2024-W03");

      expect(snapshot).not.toBeNull();
      const weekStart = new Date(snapshot!.startDate);
      expect(weekStart.getUTCDay()).toBe(1);
    });
  });
});
