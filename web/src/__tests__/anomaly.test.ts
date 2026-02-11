// Anomaly detection engine tests
// Tests threshold rules, trend rules, and negative paths

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HealthMetricPoint, WeeklySnapshot } from "@/lib/db/types";

// Mock the DB module
const mockGetHealthMetricsForWindow = vi.fn();

vi.mock("@/lib/db", () => ({
  getHealthMetricsForWindow: (...args: unknown[]) =>
    mockGetHealthMetricsForWindow(...args),
}));

import { detectAnomalies } from "@/lib/anomaly/detector";

describe("Anomaly Detection Engine", () => {
  beforeEach(() => {
    mockGetHealthMetricsForWindow.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Threshold Rules", () => {
    it("should detect weight change >5% in 7 days", async () => {
      const userId = "test-user-1";
      const now = Date.now();

      // Mock baseline weight from 7 and 8 days ago (need 2+ points for baseline)
      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          {
            timestamp: now - 8 * 24 * 60 * 60 * 1000,
            value: 70,
            unit: "kg",
            source: "manual",
            confidence: 1,
          },
          {
            timestamp: now - 7 * 24 * 60 * 60 * 1000,
            value: 70,
            unit: "kg",
            source: "manual",
            confidence: 1,
          },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      // Current weight is 74kg (5.7% increase)
      const result = await detectAnomalies(userId, "weight", 74, "kg", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].metricType).toBe("weight");
      // 74kg vs 70kg baseline = 5.7% increase, which is "moderate" (>=5% for weight)
      expect(result.anomalies[0].severity).toBe("moderate");
      expect(result.anomalies[0].rationale).toContain("增加");
    });

    it("should detect sleep duration <4 hours", async () => {
      const userId = "test-user-2";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 3.5, "hours", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.ruleId === "sleep-duration-low")).toBe(
        true
      );
    });

    it("should detect sleep duration >12 hours", async () => {
      const userId = "test-user-3";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 13, "hours", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.ruleId === "sleep-duration-high")).toBe(
        true
      );
    });

    it("should detect resting heart rate >100 bpm", async () => {
      const userId = "test-user-4";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          {
            timestamp: now - 3 * 24 * 60 * 60 * 1000,
            value: 72,
            unit: "bpm",
            source: "apple_health",
            confidence: 0.95,
          },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 105, "bpm", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.ruleId === "heartrate-resting-high")).toBe(
        true
      );
      // 105 bpm is 5% over threshold (100 bpm), which is "mild" (<15% for heartRate)
      expect(result.anomalies[0].severity).toBe("mild");
    });

    it("should detect resting heart rate <40 bpm", async () => {
      const userId = "test-user-5";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 38, "bpm", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.ruleId === "heartrate-resting-low")).toBe(
        true
      );
    });
  });

  describe("Trend Rules", () => {
    it("should detect consecutive weight increase over 3 weeks", async () => {
      const userId = "test-user-6";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [
          { weekId: "2024-W01", avg: 70, min: 69, max: 71 },
          { weekId: "2024-W02", avg: 70.5, min: 69.5, max: 71.5 },
          { weekId: "2024-W03", avg: 71.2, min: 70.2, max: 72.2 },
          { weekId: "2024-W04", avg: 72, min: 71, max: 73 },
        ] as WeeklySnapshot[],
      });

      const result = await detectAnomalies(userId, "weight", 72.5, "kg", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(
        result.anomalies.some((a) => a.ruleId === "weight-trend-consecutive")
      ).toBe(true);
    });

    it("should detect heart rate trending up for 5+ days", async () => {
      const userId = "test-user-7";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          { timestamp: now - 6 * 24 * 60 * 60 * 1000, value: 65, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 5 * 24 * 60 * 60 * 1000, value: 68, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 4 * 24 * 60 * 60 * 1000, value: 71, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 3 * 24 * 60 * 60 * 1000, value: 74, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 2 * 24 * 60 * 60 * 1000, value: 77, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 1 * 24 * 60 * 60 * 1000, value: 80, unit: "bpm", source: "apple_health", confidence: 0.9 },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 82, "bpm", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.ruleId === "heartrate-trend-up")).toBe(
        true
      );
    });

    it("should detect irregular sleep schedule", async () => {
      const userId = "test-user-8";
      const now = Date.now();

      // High variance in sleep duration (irregular schedule)
      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          { timestamp: now - 7 * 24 * 60 * 60 * 1000, value: 5, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 6 * 24 * 60 * 60 * 1000, value: 9, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 5 * 24 * 60 * 60 * 1000, value: 4.5, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 4 * 24 * 60 * 60 * 1000, value: 10, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 3 * 24 * 60 * 60 * 1000, value: 5.5, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 2 * 24 * 60 * 60 * 1000, value: 8.5, unit: "hours", source: "manual", confidence: 0.9 },
          { timestamp: now - 1 * 24 * 60 * 60 * 1000, value: 4, unit: "hours", source: "manual", confidence: 0.9 },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 6, "hours", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(
        result.anomalies.some((a) => a.ruleId === "sleep-schedule-irregular")
      ).toBe(true);
      expect(result.anomalies[0].severity).toBe("mild");
    });
  });

  describe("Negative Path Tests - Normal Fluctuations", () => {
    it("should NOT alert on normal weight fluctuation (<2%)", async () => {
      const userId = "test-user-9";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          {
            timestamp: now - 7 * 24 * 60 * 60 * 1000,
            value: 70,
            unit: "kg",
            source: "manual",
            confidence: 1,
          },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      // 1% increase (within normal fluctuation)
      const result = await detectAnomalies(userId, "weight", 70.7, "kg", now);

      expect(result.anomalies.length).toBe(0);
    });

    it("should NOT alert on normal sleep duration (7-9 hours)", async () => {
      const userId = "test-user-10";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 7.5, "hours", now);

      expect(result.anomalies.length).toBe(0);
    });

    it("should NOT alert on normal heart rate (60-100 bpm)", async () => {
      const userId = "test-user-11";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 72, "bpm", now);

      expect(result.anomalies.length).toBe(0);
    });

    it("should NOT alert on stable weight over time", async () => {
      const userId = "test-user-12";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [
          { weekId: "2024-W01", avg: 70.1, min: 69.5, max: 70.8 },
          { weekId: "2024-W02", avg: 70.0, min: 69.3, max: 70.7 },
          { weekId: "2024-W03", avg: 70.2, min: 69.6, max: 70.9 },
        ] as WeeklySnapshot[],
      });

      const result = await detectAnomalies(userId, "weight", 70.1, "kg", now);

      expect(result.anomalies.length).toBe(0);
    });

    it("should NOT alert on stable heart rate over time", async () => {
      const userId = "test-user-13";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [
          { timestamp: now - 5 * 24 * 60 * 60 * 1000, value: 70, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 4 * 24 * 60 * 60 * 1000, value: 71, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 3 * 24 * 60 * 60 * 1000, value: 69, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 2 * 24 * 60 * 60 * 1000, value: 72, unit: "bpm", source: "apple_health", confidence: 0.9 },
          { timestamp: now - 1 * 24 * 60 * 60 * 1000, value: 70, unit: "bpm", source: "apple_health", confidence: 0.9 },
        ] as HealthMetricPoint[],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 71, "bpm", now);

      expect(result.anomalies.length).toBe(0);
    });
  });

  describe("Alert Payload Structure", () => {
    it("should return anomaly with severity, rationale, and guidance", async () => {
      const userId = "test-user-14";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 3, "hours", now);

      expect(result.anomalies.length).toBeGreaterThan(0);
      const anomaly = result.anomalies[0];

      // Verify severity
      expect(["mild", "moderate", "attention"]).toContain(anomaly.severity);

      // Verify rationale
      expect(anomaly.rationale).toBeTruthy();
      expect(anomaly.rationale.length).toBeGreaterThan(0);

      // Verify suggested action
      expect(anomaly.suggestedAction).toBeTruthy();
      expect(anomaly.suggestedAction.length).toBeGreaterThan(0);

      // Verify other required fields
      expect(anomaly.id).toBeTruthy();
      expect(anomaly.ruleId).toBeTruthy();
      expect(anomaly.metricType).toBe("sleep");
      expect(anomaly.metricValue).toBe(3);
      expect(anomaly.unit).toBe("hours");
      expect(anomaly.detectedAt).toBe(now);
    });

    it("should sort anomalies by severity (attention > moderate > mild)", async () => {
      const userId = "test-user-15";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      // This will trigger both threshold rules
      const result = await detectAnomalies(userId, "heartRate", 110, "bpm", now);

      if (result.anomalies.length > 1) {
        const severityOrder = { attention: 3, moderate: 2, mild: 1 };
        for (let i = 0; i < result.anomalies.length - 1; i++) {
          expect(severityOrder[result.anomalies[i].severity]).toBeGreaterThanOrEqual(
            severityOrder[result.anomalies[i + 1].severity]
          );
        }
      }
    });
  });

  describe("Safety Compliance", () => {
    it("should NOT use diagnostic language in rationale", async () => {
      const userId = "test-user-16";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "sleep", 3, "hours", now);

      const prohibitedTerms = ["诊断", "确诊", "患有", "病症", "治疗", "异常", "危险", "危急"];

      for (const anomaly of result.anomalies) {
        for (const term of prohibitedTerms) {
          expect(anomaly.rationale).not.toContain(term);
          expect(anomaly.suggestedAction).not.toContain(term);
        }
      }
    });

    it("should NOT claim medical certainty", async () => {
      const userId = "test-user-17";
      const now = Date.now();

      mockGetHealthMetricsForWindow.mockResolvedValue({
        raw: [],
        weekly: [],
      });

      const result = await detectAnomalies(userId, "heartRate", 110, "bpm", now);

      const certaintyTerms = ["肯定", "一定", "必须", "绝对"];

      for (const anomaly of result.anomalies) {
        for (const term of certaintyTerms) {
          expect(anomaly.rationale).not.toContain(term);
          expect(anomaly.suggestedAction).not.toContain(term);
        }
      }
    });
  });
});
