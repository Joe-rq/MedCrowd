import { describe, it, expect, beforeEach } from "vitest";
import type { HealthMetricsOps, WeeklySnapshot, HealthMetricPoint } from "@/lib/db/types";
import type { ReportGenerationOptions } from "../types";
import { generateWeeklyReport, getReportWeekOptions } from "../generator";

// Helper: calculate week ID relative to current date for realistic tests
function getCurrentWeekId(): string {
  const now = Date.now();
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

function getPreviousWeekId(weekId: string): string {
  const parts = weekId.split("-W");
  const year = parseInt(parts[0], 10);
  const weekNum = parseInt(parts[1], 10);
  if (weekNum === 1) {
    return `${year - 1}-W52`;
  }
  return `${year}-W${(weekNum - 1).toString().padStart(2, "0")}`;
}

function getWeekOffset(weekId: string, offset: number): string {
  const parts = weekId.split("-W");
  const year = parseInt(parts[0], 10);
  const weekNum = parseInt(parts[1], 10);
  const newWeekNum = weekNum + offset;
  if (newWeekNum < 1) {
    return `${year - 1}-W${(52 + newWeekNum).toString().padStart(2, "0")}`;
  }
  if (newWeekNum > 52) {
    return `${year + 1}-W${(newWeekNum - 52).toString().padStart(2, "0")}`;
  }
  return `${year}-W${newWeekNum.toString().padStart(2, "0")}`;
}

function createMockOps(mockSnapshots: Map<string, WeeklySnapshot>): HealthMetricsOps {
  return {
    addRawMetric: async () => {},
    addRawMetricsBatch: async () => ({ success: 0, failed: 0 }),
    getRawMetrics: async () => [],
    saveWeeklySnapshot: async () => {},
    getWeeklySnapshots: async (_userId, metricType, startWeek, endWeek) => {
      const results: WeeklySnapshot[] = [];
      for (const [, snapshot] of mockSnapshots.entries()) {
        if (snapshot.metricType === metricType && snapshot.weekId >= startWeek && snapshot.weekId <= endWeek) {
          results.push(snapshot);
        }
      }
      return results.sort((a, b) => a.startDate - b.startDate);
    },
    aggregateToWeekly: async () => null,
    getMetricsForWindow: async () => ({ raw: [], weekly: [] }),
    updateMetricsIndex: async () => {},
    getUserMetricTypes: async () => [],
    deleteAllUserMetrics: async () => {},
    checkMigrationTriggers: async () => ({
      shouldMigrate: false,
      reasons: [],
      metrics: { highLatencyOps: 0, totalOps: 0 },
    }),
  };
}

function createMockSnapshot(
  weekId: string,
  metricType: string,
  avg: number,
  overrides: Partial<WeeklySnapshot> = {}
): WeeklySnapshot {
  const year = parseInt(weekId.split("-W")[0]);
  const weekNum = parseInt(weekId.split("-W")[1]);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const startDate = new Date(yearStart.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
  const dayOfWeek = startDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setUTCDate(startDate.getUTCDate() + mondayOffset);

  return {
    weekId,
    startDate: startDate.getTime(),
    endDate: startDate.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999,
    metricType: metricType as WeeklySnapshot["metricType"],
    avg,
    min: avg * 0.95,
    max: avg * 1.05,
    count: 7,
    unit: metricType === "weight" ? "kg" : metricType === "sleep" ? "h" : "bpm",
    source: "test",
    confidence: 0.9,
    rawDataPoints: 7,
    ...overrides,
  };
}

describe("generateWeeklyReport", () => {
  let mockSnapshots: Map<string, WeeklySnapshot>;

  beforeEach(() => {
    mockSnapshots = new Map();
  });

  it("returns error when no data available", async () => {
    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: "2025-W06",
    };

    const { report, error } = await generateWeeklyReport(ops, options);

    expect(report).toBeNull();
    expect(error).toBe("本周没有足够的数据生成报告");
  });

  it("generates report with single metric", async () => {
    const weekId = "2025-W06";
    mockSnapshots.set("weight_2025-W06", createMockSnapshot(weekId, "weight", 70.5));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId,
    };

    const { report, error } = await generateWeeklyReport(ops, options);

    expect(error).toBeUndefined();
    expect(report).not.toBeNull();
    expect(report!.metrics).toHaveLength(1);
    expect(report!.metrics[0].metricType).toBe("weight");
    expect(report!.metrics[0].currentWeek.avg).toBe(70.5);
    expect(report!.metrics[0].trend.direction).toBe("insufficient_data");
  });

  it("detects upward trend correctly", async () => {
    const currentWeek = "2025-W06";
    const prevWeek = "2025-W05";
    mockSnapshots.set("weight_2025-W05", createMockSnapshot(prevWeek, "weight", 70.0));
    mockSnapshots.set("weight_2025-W06", createMockSnapshot(currentWeek, "weight", 71.5));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.metrics[0].trend.direction).toBe("up");
    expect(report!.metrics[0].trend.absoluteChange).toBe(1.5);
    expect(report!.metrics[0].trend.percentageChange).toBeGreaterThan(0);
  });

  it("detects downward trend correctly", async () => {
    const currentWeek = "2025-W06";
    const prevWeek = "2025-W05";
    mockSnapshots.set("weight_2025-W05", createMockSnapshot(prevWeek, "weight", 72.0));
    mockSnapshots.set("weight_2025-W06", createMockSnapshot(currentWeek, "weight", 70.5));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.metrics[0].trend.direction).toBe("down");
    expect(report!.metrics[0].trend.absoluteChange).toBe(-1.5);
    expect(report!.metrics[0].trend.percentageChange).toBeLessThan(0);
  });

  it("identifies stable trend within threshold", async () => {
    const currentWeek = "2025-W06";
    const prevWeek = "2025-W05";
    mockSnapshots.set("weight_2025-W05", createMockSnapshot(prevWeek, "weight", 70.0));
    mockSnapshots.set("weight_2025-W06", createMockSnapshot(currentWeek, "weight", 70.1));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.metrics[0].trend.direction).toBe("stable");
  });

  it("calculates personal baseline from history", async () => {
    const currentWeek = getCurrentWeekId();
    mockSnapshots.set(`weight_${getWeekOffset(currentWeek, -4)}`, createMockSnapshot(getWeekOffset(currentWeek, -4), "weight", 69.0));
    mockSnapshots.set(`weight_${getWeekOffset(currentWeek, -3)}`, createMockSnapshot(getWeekOffset(currentWeek, -3), "weight", 69.5));
    mockSnapshots.set(`weight_${getWeekOffset(currentWeek, -2)}`, createMockSnapshot(getWeekOffset(currentWeek, -2), "weight", 70.0));
    mockSnapshots.set(`weight_${getWeekOffset(currentWeek, -1)}`, createMockSnapshot(getWeekOffset(currentWeek, -1), "weight", 70.5));
    mockSnapshots.set(`weight_${currentWeek}`, createMockSnapshot(currentWeek, "weight", 71.0));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.metrics[0].baseline).toBeDefined();
    expect(report!.metrics[0].baseline!.value).toBeCloseTo(70.0, 0);
  });

  it("detects moderate anomaly when deviation exceeds threshold", async () => {
    const currentWeek = getCurrentWeekId();
    mockSnapshots.set(`heartRate_${getWeekOffset(currentWeek, -2)}`, createMockSnapshot(getWeekOffset(currentWeek, -2), "heartRate", 70));
    mockSnapshots.set(`heartRate_${getWeekOffset(currentWeek, -1)}`, createMockSnapshot(getWeekOffset(currentWeek, -1), "heartRate", 71));
    mockSnapshots.set(`heartRate_${currentWeek}`, createMockSnapshot(currentWeek, "heartRate", 85));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.anomalies.length).toBeGreaterThan(0);
    expect(report!.anomalies[0].severity).toBe("moderate");
    expect(report!.anomalies[0].consultationRecommended).toBe(true);
  });

  it("generates milestones for consistent recording", async () => {
    const currentWeek = getCurrentWeekId();
    mockSnapshots.set(`sleep_${currentWeek}`, createMockSnapshot(currentWeek, "sleep", 7.5, { count: 7 }));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.milestones.length).toBeGreaterThan(0);
    expect(report!.milestones.some((m) => m.type === "streak")).toBe(true);
  });

  it("includes consultation handoff for attention-level anomalies", async () => {
    const currentWeek = getCurrentWeekId();
    mockSnapshots.set(`heartRate_${getWeekOffset(currentWeek, -2)}`, createMockSnapshot(getWeekOffset(currentWeek, -2), "heartRate", 70));
    mockSnapshots.set(`heartRate_${getWeekOffset(currentWeek, -1)}`, createMockSnapshot(getWeekOffset(currentWeek, -1), "heartRate", 72));
    mockSnapshots.set(`heartRate_${currentWeek}`, createMockSnapshot(currentWeek, "heartRate", 95));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.consultationHandoff).toBeDefined();
    expect(report!.consultationHandoff!.suggestedQuestion).toContain("静息心率");
  });

  it("generates appropriate narrative", async () => {
    const currentWeek = getCurrentWeekId();
    mockSnapshots.set(`weight_${currentWeek}`, createMockSnapshot(currentWeek, "weight", 70.0));
    mockSnapshots.set(`sleep_${currentWeek}`, createMockSnapshot(currentWeek, "sleep", 7.5));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: currentWeek,
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.narrative.summary).toContain("2项健康指标");
    expect(report!.narrative.summary).toContain("体重");
    expect(report!.narrative.summary).toContain("睡眠时长");
    expect(report!.narrative.disclaimer).toContain("不构成任何形式的医疗建议");
  });

  it("processes multiple metrics simultaneously", async () => {
    mockSnapshots.set("weight_2025-W06", createMockSnapshot("2025-W06", "weight", 70.0));
    mockSnapshots.set("bmi_2025-W06", createMockSnapshot("2025-W06", "bmi", 22.5));
    mockSnapshots.set("sleep_2025-W06", createMockSnapshot("2025-W06", "sleep", 7.5));
    mockSnapshots.set("heartRate_2025-W06", createMockSnapshot("2025-W06", "heartRate", 72));
    mockSnapshots.set("hrv_2025-W06", createMockSnapshot("2025-W06", "hrv", 45));

    const ops = createMockOps(mockSnapshots);
    const options: ReportGenerationOptions = {
      userId: "user_test",
      weekId: "2025-W06",
    };

    const { report } = await generateWeeklyReport(ops, options);

    expect(report!.metrics).toHaveLength(5);
    const metricTypes = report!.metrics.map((m) => m.metricType);
    expect(metricTypes).toContain("weight");
    expect(metricTypes).toContain("bmi");
    expect(metricTypes).toContain("sleep");
    expect(metricTypes).toContain("heartRate");
    expect(metricTypes).toContain("hrv");
  });
});
